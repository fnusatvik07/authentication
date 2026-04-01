"""Project 1: Basic JWT Authentication API.

Endpoints:
    POST /api/register  - Register a new user
    POST /api/login     - Login and get JWT token
    GET  /api/me        - Get current user profile (protected)
    GET  /api/protected - Access protected data (protected)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_db
from models import UserRegister, UserLogin, UserResponse, Token
from auth import hash_password, verify_password, create_access_token, get_current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Project 1: Basic JWT Auth", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/register", response_model=UserResponse, status_code=201)
def register(user: UserRegister):
    """Register a new user with username, email, and password."""
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?",
        (user.username, user.email)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email already exists")

    password_hash = hash_password(user.password)
    cursor = conn.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (user.username, user.email, password_hash)
    )
    conn.commit()
    new_user = conn.execute("SELECT id, username, email FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(new_user)


MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


@app.post("/api/login", response_model=Token)
def login(user: UserLogin):
    """Login with account lockout protection.

    After 5 failed attempts, the account is locked for 15 minutes.
    """
    from datetime import datetime, timedelta, timezone

    conn = get_db()
    db_user = conn.execute(
        "SELECT id, username, email, password_hash, failed_login_attempts, locked_until FROM users WHERE username = ?",
        (user.username,)
    ).fetchone()

    if not db_user:
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

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
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            conn.execute("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?",
                         (attempts, lock_until, db_user["id"]))
        else:
            conn.execute("UPDATE users SET failed_login_attempts = ? WHERE id = ?", (attempts, db_user["id"]))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    # Success — reset attempts
    conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (db_user["id"],))
    conn.commit()
    conn.close()

    access_token = create_access_token(data={"sub": db_user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return current_user


@app.get("/api/protected")
def protected_route(current_user: dict = Depends(get_current_user)):
    """Example protected endpoint - only accessible with valid JWT."""
    return {
        "message": f"Hello {current_user['username']}! You have access to this protected resource.",
        "user_id": current_user["id"],
    }


@app.get("/api/health")
def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "basic-jwt-auth"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
