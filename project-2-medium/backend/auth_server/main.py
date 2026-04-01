"""Project 2: Auth Server — RS256 JWT, RBAC, account lockout, password reset.

Runs on port 8000. Signs tokens with RSA private key.
Resource server verifies with the public key (GET /api/public-key).
"""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db
from models import (
    UserRegister, UserLogin, UserResponse, TokenPair, RefreshRequest,
    RoleUpdate, PasswordResetRequest, PasswordResetConfirm,
)
from auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, hash_refresh_token, get_current_user,
    require_role, ROLE_HIERARCHY, REFRESH_TOKEN_EXPIRE_DAYS,
    PUBLIC_KEY, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES,
)

import secrets
import hashlib


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE role = 'super_admin'").fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("admin", "admin@example.com", hash_password("admin123"), "super_admin")
        )
        conn.commit()
    conn.close()
    yield

app = FastAPI(title="Project 2: Auth Server (RS256)", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────
# Public Key endpoint — resource servers fetch this
# ──────────────────────────────────────────────────────

@app.get("/api/public-key")
def get_public_key():
    """Return the RSA public key for token verification.

    Resource servers call this to get the key they need to verify JWTs.
    This is safe to expose publicly — it can only VERIFY, not SIGN tokens.
    """
    return {"public_key": PUBLIC_KEY.decode("utf-8"), "algorithm": "RS256"}


# ──────────────────────────────────────────────────────
# Registration
# ──────────────────────────────────────────────────────

@app.post("/api/register", response_model=UserResponse, status_code=201)
def register(user: UserRegister):
    if user.role not in ROLE_HIERARCHY:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {list(ROLE_HIERARCHY.keys())}")
    if user.role != "user":
        raise HTTPException(status_code=403, detail="Can only self-register as 'user'. Contact admin for role upgrade.")

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?", (user.username, user.email)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email already exists")

    pw_hash = hash_password(user.password)
    cursor = conn.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
        (user.username, user.email, pw_hash, "user")
    )
    conn.commit()
    new_user = conn.execute("SELECT id, username, email, role FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(new_user)


# ──────────────────────────────────────────────────────
# Login with account lockout
# ──────────────────────────────────────────────────────

@app.post("/api/login", response_model=TokenPair)
def login(user: UserLogin):
    """Login with account lockout protection.

    After MAX_FAILED_ATTEMPTS wrong passwords, the account is locked
    for LOCKOUT_DURATION_MINUTES minutes.
    """
    conn = get_db()
    db_user = conn.execute(
        "SELECT id, username, email, password_hash, role, is_active, "
        "failed_login_attempts, locked_until FROM users WHERE username = ?",
        (user.username,)
    ).fetchone()

    if not db_user:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not db_user["is_active"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Check account lockout
    if db_user["locked_until"]:
        locked_until = datetime.fromisoformat(db_user["locked_until"])
        if locked_until > datetime.now(timezone.utc):
            remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
            conn.close()
            raise HTTPException(
                status_code=423,
                detail=f"Account locked due to too many failed attempts. Try again in {remaining} minutes.",
            )
        else:
            # Lock expired — reset attempts
            conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (db_user["id"],))
            conn.commit()

    # Verify password
    if not verify_password(user.password, db_user["password_hash"]):
        attempts = (db_user["failed_login_attempts"] or 0) + 1
        if attempts >= MAX_FAILED_ATTEMPTS:
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)).isoformat()
            conn.execute(
                "UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
                (attempts, lock_until, db_user["id"])
            )
            conn.commit()
            conn.close()
            raise HTTPException(
                status_code=423,
                detail=f"Account locked after {MAX_FAILED_ATTEMPTS} failed attempts. Try again in {LOCKOUT_DURATION_MINUTES} minutes.",
            )
        else:
            conn.execute("UPDATE users SET failed_login_attempts = ? WHERE id = ?", (attempts, db_user["id"]))
            conn.commit()
            conn.close()
            raise HTTPException(status_code=401, detail=f"Invalid credentials ({MAX_FAILED_ATTEMPTS - attempts} attempts remaining)")

    # Successful login — reset failed attempts
    conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (db_user["id"],))

    access_token = create_access_token({
        "sub": db_user["username"],
        "user_id": db_user["id"],
        "role": db_user["role"],
    })
    refresh_token = create_refresh_token()
    token_hash = hash_refresh_token(refresh_token)
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (db_user["id"], token_hash, expires.isoformat())
    )
    conn.commit()
    conn.close()

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


# ──────────────────────────────────────────────────────
# Token refresh
# ──────────────────────────────────────────────────────

@app.post("/api/refresh", response_model=TokenPair)
def refresh(req: RefreshRequest):
    token_hash = hash_refresh_token(req.refresh_token)
    conn = get_db()

    stored = conn.execute(
        "SELECT rt.id, rt.user_id, rt.expires_at, rt.is_revoked, u.username, u.role "
        "FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id "
        "WHERE rt.token_hash = ?",
        (token_hash,)
    ).fetchone()

    if not stored or stored["is_revoked"]:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if datetime.fromisoformat(stored["expires_at"]) < datetime.now(timezone.utc):
        conn.close()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    conn.execute("UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?", (stored["id"],))

    access_token = create_access_token({
        "sub": stored["username"],
        "user_id": stored["user_id"],
        "role": stored["role"],
    })
    new_refresh = create_refresh_token()
    new_hash = hash_refresh_token(new_refresh)
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (stored["user_id"], new_hash, expires.isoformat())
    )
    conn.commit()
    conn.close()

    return {"access_token": access_token, "refresh_token": new_refresh, "token_type": "bearer"}


# ──────────────────────────────────────────────────────
# Password Reset (token-based)
# ──────────────────────────────────────────────────────

@app.post("/api/password-reset/request")
def request_password_reset(req: PasswordResetRequest):
    """Request a password reset. Returns a reset token.

    In production, this token would be sent via email.
    For learning purposes, we return it directly in the response.
    """
    conn = get_db()
    user = conn.execute("SELECT id, email FROM users WHERE email = ?", (req.email,)).fetchone()
    if not user:
        conn.close()
        # Don't reveal whether email exists (timing-safe)
        return {"message": "If the email exists, a reset link has been sent."}

    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    conn.execute(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        (user["id"], token_hash, expires)
    )
    conn.commit()
    conn.close()

    return {
        "message": "If the email exists, a reset link has been sent.",
        # In production, send this via email — exposed here for learning/testing
        "_debug_reset_token": reset_token,
    }


@app.post("/api/password-reset/confirm")
def confirm_password_reset(req: PasswordResetConfirm):
    """Reset password using the reset token."""
    token_hash = hashlib.sha256(req.reset_token.encode()).hexdigest()
    conn = get_db()

    stored = conn.execute(
        "SELECT prt.id, prt.user_id, prt.expires_at, prt.is_used "
        "FROM password_reset_tokens prt WHERE prt.token_hash = ?",
        (token_hash,)
    ).fetchone()

    if not stored:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid reset token")

    if stored["is_used"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Reset token already used")

    if datetime.fromisoformat(stored["expires_at"]) < datetime.now(timezone.utc):
        conn.close()
        raise HTTPException(status_code=400, detail="Reset token expired")

    # Update password and mark token as used
    new_hash = hash_password(req.new_password)
    conn.execute("UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
                 (new_hash, stored["user_id"]))
    conn.execute("UPDATE password_reset_tokens SET is_used = 1 WHERE id = ?", (stored["id"],))
    conn.commit()
    conn.close()

    return {"message": "Password reset successfully. You can now login with your new password."}


# ──────────────────────────────────────────────────────
# User profile & management
# ──────────────────────────────────────────────────────

@app.get("/api/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, email, role FROM users WHERE username = ?",
        (current_user["sub"],)
    ).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@app.get("/api/users")
def list_users(current_user: dict = Depends(require_role("admin"))):
    conn = get_db()
    users = conn.execute(
        "SELECT id, username, email, role, is_active, failed_login_attempts, locked_until, created_at FROM users"
    ).fetchall()
    conn.close()
    return [dict(u) for u in users]


@app.put("/api/users/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, current_user: dict = Depends(require_role("super_admin"))):
    if body.role not in ROLE_HIERARCHY:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
    conn = get_db()
    conn.execute("UPDATE users SET role = ? WHERE id = ?", (body.role, user_id))
    conn.commit()
    user = conn.execute("SELECT id, username, email, role FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@app.get("/api/roles")
def list_roles():
    return {"roles": ROLE_HIERARCHY}


@app.post("/api/logout")
def logout_user(req: RefreshRequest):
    token_hash = hash_refresh_token(req.refresh_token)
    conn = get_db()
    conn.execute("UPDATE refresh_tokens SET is_revoked = 1 WHERE token_hash = ?", (token_hash,))
    conn.commit()
    conn.close()
    return {"message": "Logged out"}


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "auth-server", "algorithm": "RS256"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
