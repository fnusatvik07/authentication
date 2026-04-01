"""Project 3: Agentic RAG with Authenticated Multi-Tool Search.

Single FastAPI server that handles:
- User authentication (JWT + RBAC)
- RAG chat endpoint with role-gated tool access
- User management (admin)
- Query audit logging

Runs on port 8000.
"""

import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend is in path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from auth_service.database import init_db, get_db
from auth_service.models import (
    UserRegister, UserLogin, UserResponse, TokenPair,
    RefreshRequest, RoleUpdate, ChatQuery, ChatResponse,
)
from auth_service.auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, hash_token, get_current_user,
    require_role, get_available_tools, ROLE_HIERARCHY,
    REFRESH_TOKEN_EXPIRE_DAYS, TOOL_PERMISSIONS,
)
from rag_agent.agent import run_agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Seed users if empty
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count == 0:
        users = [
            ("admin", "admin@example.com", hash_password("admin123"), "super_admin", "executive"),
            ("manager", "manager@example.com", hash_password("manager123"), "admin", "engineering"),
            ("developer", "developer@example.com", hash_password("dev123"), "user", "engineering"),
            ("viewer", "viewer@example.com", hash_password("viewer123"), "guest", "general"),
        ]
        for u in users:
            conn.execute(
                "INSERT INTO users (username, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)", u
            )
        conn.commit()
    conn.close()
    yield

app = FastAPI(title="Project 3: Agentic RAG with Auth", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────
# Auth Endpoints
# ──────────────────────────────────────────────────────

@app.post("/api/register", response_model=UserResponse, status_code=201)
def register(user: UserRegister):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?", (user.username, user.email)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email already exists")
    pw_hash = hash_password(user.password)
    cursor = conn.execute(
        "INSERT INTO users (username, email, password_hash, role, department) VALUES (?, ?, ?, 'user', ?)",
        (user.username, user.email, pw_hash, user.department)
    )
    conn.commit()
    new_user = conn.execute(
        "SELECT id, username, email, role, department FROM users WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    conn.close()
    return dict(new_user)


@app.post("/api/login", response_model=TokenPair)
def login(user: UserLogin):
    """Login with account lockout protection."""
    from auth_service.auth import MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES

    conn = get_db()
    db_user = conn.execute(
        "SELECT id, username, email, password_hash, role, department, is_active, "
        "failed_login_attempts, locked_until FROM users WHERE username = ?",
        (user.username,)
    ).fetchone()

    if not db_user:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not db_user["is_active"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Check lockout
    if db_user["locked_until"]:
        locked_until = datetime.fromisoformat(db_user["locked_until"])
        if locked_until > datetime.now(timezone.utc):
            conn.close()
            raise HTTPException(status_code=423, detail="Account locked. Try again later.")
        else:
            conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (db_user["id"],))
            conn.commit()

    if not verify_password(user.password, db_user["password_hash"]):
        attempts = (db_user["failed_login_attempts"] or 0) + 1
        if attempts >= MAX_FAILED_ATTEMPTS:
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)).isoformat()
            conn.execute("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
                         (attempts, lock_until, db_user["id"]))
        else:
            conn.execute("UPDATE users SET failed_login_attempts = ? WHERE id = ?", (attempts, db_user["id"]))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Success — reset attempts
    conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (db_user["id"],))

    access_token = create_access_token({
        "sub": db_user["username"],
        "user_id": db_user["id"],
        "role": db_user["role"],
        "department": db_user["department"],
    })
    refresh_token = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (db_user["id"], hash_token(refresh_token), expires.isoformat())
    )
    conn.commit()
    conn.close()
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@app.post("/api/refresh", response_model=TokenPair)
def refresh(req: RefreshRequest):
    conn = get_db()
    stored = conn.execute(
        "SELECT rt.id, rt.user_id, rt.expires_at, rt.is_revoked, u.username, u.role, u.department "
        "FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token_hash = ?",
        (hash_token(req.refresh_token),)
    ).fetchone()

    if not stored or stored["is_revoked"]:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if datetime.fromisoformat(stored["expires_at"]) < datetime.now(timezone.utc):
        conn.close()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    conn.execute("UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?", (stored["id"],))

    access_token = create_access_token({
        "sub": stored["username"], "user_id": stored["user_id"],
        "role": stored["role"], "department": stored["department"],
    })
    new_refresh = create_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (stored["user_id"], hash_token(new_refresh), expires.isoformat())
    )
    conn.commit()
    conn.close()
    return {"access_token": access_token, "refresh_token": new_refresh, "token_type": "bearer"}


@app.get("/api/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, email, role, department FROM users WHERE username = ?",
        (current_user["sub"],)
    ).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


# ──────────────────────────────────────────────────────
# RAG Chat Endpoint
# ──────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
def chat(query: ChatQuery, current_user: dict = Depends(get_current_user)):
    """Send a query to the ReAct RAG agent.

    The agent runs a Think→Act→Observe loop:
    1. THINKS about what information it needs
    2. ACTS by calling a role-gated search tool
    3. OBSERVES the results
    4. Repeats until it has enough info, then answers

    Supports conversation_history for multi-turn context.
    """
    user_role = current_user.get("role", "guest")
    username = current_user.get("sub", "unknown")

    # Convert Pydantic models to dicts for the agent
    history = [{"role": m.role, "content": m.content} for m in query.conversation_history]

    result = run_agent(query.message, user_role, username, conversation_history=history)

    # Audit log
    conn = get_db()
    step_count = len(result.get("reasoning_steps", []))
    conn.execute(
        "INSERT INTO query_audit_log (user_id, username, role, query, tools_used) VALUES (?, ?, ?, ?, ?)",
        (current_user.get("user_id"), username, user_role, query.message,
         ",".join(result["tools_used"]) + f" ({step_count} steps)")
    )
    conn.commit()
    conn.close()

    return result


@app.get("/api/tools")
def list_tools(current_user: dict = Depends(get_current_user)):
    """List search tools available to the current user based on their role."""
    user_role = current_user.get("role", "guest")
    available = get_available_tools(user_role)
    all_tools = []
    for name, req_role in TOOL_PERMISSIONS.items():
        all_tools.append({
            "name": name,
            "required_role": req_role,
            "accessible": name in available,
        })
    return {"user_role": user_role, "tools": all_tools}


# ──────────────────────────────────────────────────────
# Admin Endpoints
# ──────────────────────────────────────────────────────

@app.get("/api/users")
def list_users(current_user: dict = Depends(require_role("admin"))):
    conn = get_db()
    users = conn.execute("SELECT id, username, email, role, department, is_active, created_at FROM users").fetchall()
    conn.close()
    return [dict(u) for u in users]


@app.put("/api/users/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, current_user: dict = Depends(require_role("super_admin"))):
    if body.role not in ROLE_HIERARCHY:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
    conn = get_db()
    conn.execute("UPDATE users SET role = ? WHERE id = ?", (body.role, user_id))
    conn.commit()
    user = conn.execute("SELECT id, username, email, role, department FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@app.get("/api/audit-log")
def get_audit_log(current_user: dict = Depends(require_role("admin"))):
    """View recent query audit logs."""
    conn = get_db()
    logs = conn.execute(
        "SELECT * FROM query_audit_log ORDER BY timestamp DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(l) for l in logs]


# ──────────────────────────────────────────────────────
# Logout with token blacklisting
# ──────────────────────────────────────────────────────

@app.post("/api/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """Logout: blacklist the current access token AND revoke refresh tokens.

    After this, the access token is immediately invalid — even before expiry.
    This solves the "JWT can't be revoked" problem using JTI-based blacklisting.
    """
    from auth_service.auth import blacklist_token
    jti = current_user.get("jti")
    exp = current_user.get("exp")
    if jti and exp:
        blacklist_token(jti, datetime.fromtimestamp(exp, tz=timezone.utc))

    return {"message": "Logged out — token revoked"}


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "agentic-rag-auth"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
