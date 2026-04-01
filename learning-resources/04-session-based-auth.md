# Session-Based Authentication

## What is Session-Based Auth?

Session-based authentication is the **traditional** web authentication method. The server creates a session after login, stores it server-side, and gives the client a session ID cookie. Every subsequent request sends this cookie automatically.

**Key difference from JWT:** Sessions are **stateful** — the server must store and look up session data on every request.

## How It Works

```
┌──────────┐                    ┌──────────────┐                ┌──────────────┐
│  Browser  │                    │   Server      │                │ Session Store │
│           │                    │               │                │ (Redis/DB)    │
└─────┬────┘                    └──────┬───────┘                └──────┬───────┘
      │                                │                               │
      │ 1. POST /login                 │                               │
      │    {username, password}        │                               │
      │───────────────────────────────>│                               │
      │                                │                               │
      │                                │ 2. Validate credentials       │
      │                                │                               │
      │                                │ 3. Create session             │
      │                                │    {user_id, role, ...}       │
      │                                │──────────────────────────────>│
      │                                │                               │
      │                                │ 4. Session ID returned        │
      │                                │<──────────────────────────────│
      │                                │                               │
      │ 5. Set-Cookie: session_id=abc  │                               │
      │    HttpOnly; Secure; SameSite  │                               │
      │<───────────────────────────────│                               │
      │                                │                               │
      │ 6. GET /dashboard              │                               │
      │    Cookie: session_id=abc      │                               │
      │───────────────────────────────>│                               │
      │                                │ 7. Look up session            │
      │                                │──────────────────────────────>│
      │                                │                               │
      │                                │ 8. Session data returned      │
      │                                │<──────────────────────────────│
      │                                │                               │
      │ 9. Response (based on session) │                               │
      │<───────────────────────────────│                               │
```

## Session Storage Options

| Store | Pros | Cons | Best For |
|-------|------|------|----------|
| **In-memory** | Fastest | Lost on restart, no scaling | Development |
| **Redis** | Fast, TTL support, scalable | Extra infrastructure | Production |
| **Database (SQLite/Postgres)** | Persistent, queryable | Slower | Small apps |
| **File system** | Simple | Slow, no scaling | Legacy apps |

## Session vs JWT Comparison

| Aspect | Session | JWT |
|--------|---------|-----|
| State | Server-side (stateful) | Client-side (stateless) |
| Storage | Server (Redis/DB) | Client (cookie/header) |
| Scalability | Needs shared session store | Scales naturally |
| Revocation | Instant (delete session) | Hard (wait for expiry) |
| Size | Small cookie (~32 bytes) | Larger token (~800+ bytes) |
| Server load | DB lookup per request | CPU for signature verification |
| Security | Session fixation, CSRF | Token theft, algorithm attacks |
| Best for | Traditional web apps | SPAs, APIs, microservices |

## Implementation in FastAPI

```python
from fastapi import FastAPI, Response, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import secrets
import json
from datetime import datetime, timedelta

app = FastAPI()

# Session management
def create_session(user_id: int, role: str) -> str:
    session_id = secrets.token_hex(32)
    expires = datetime.utcnow() + timedelta(hours=24)

    conn = sqlite3.connect("sessions.db")
    conn.execute(
        "INSERT INTO sessions (session_id, user_id, role, expires_at) VALUES (?, ?, ?, ?)",
        (session_id, user_id, role, expires.isoformat())
    )
    conn.commit()
    conn.close()
    return session_id

def get_session(session_id: str) -> dict | None:
    conn = sqlite3.connect("sessions.db")
    cursor = conn.execute(
        "SELECT user_id, role, expires_at FROM sessions WHERE session_id = ?",
        (session_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None
    if datetime.fromisoformat(row[2]) < datetime.utcnow():
        destroy_session(session_id)
        return None
    return {"user_id": row[0], "role": row[1]}

def destroy_session(session_id: str):
    conn = sqlite3.connect("sessions.db")
    conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()

@app.post("/login")
async def login(response: Response, username: str, password: str):
    # ... validate credentials ...
    session_id = create_session(user_id=1, role="user")
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,      # JavaScript can't access
        secure=True,        # HTTPS only
        samesite="strict",  # CSRF protection
        max_age=86400       # 24 hours
    )
    return {"message": "Logged in"}

@app.get("/dashboard")
async def dashboard(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    return {"user_id": session["user_id"], "role": session["role"]}

@app.post("/logout")
async def logout(request: Request, response: Response):
    session_id = request.cookies.get("session_id")
    if session_id:
        destroy_session(session_id)
    response.delete_cookie("session_id")
    return {"message": "Logged out"}
```

## Security Best Practices

1. **Use HTTP-only cookies** — prevents XSS from reading session ID
2. **Set Secure flag** — cookie only sent over HTTPS
3. **Set SameSite=Strict** — prevents CSRF attacks
4. **Regenerate session ID after login** — prevents session fixation
5. **Set reasonable expiration** — don't keep sessions forever
6. **Implement idle timeout** — expire after inactivity
7. **Use CSRF tokens** for state-changing operations
8. **Store minimal data in session** — just user ID and role

## When to Use Sessions

**Good fit:**
- Traditional server-rendered web applications
- When you need instant session revocation (logout everywhere)
- Admin panels, dashboards
- When token size matters

**Poor fit:**
- SPAs with separate API backends
- Mobile applications
- Microservice architectures (session sharing is complex)
- Stateless API design
