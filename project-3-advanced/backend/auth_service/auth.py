"""JWT + RBAC + token blacklisting + account lockout for the Agentic RAG system.

Token blacklisting: Each access token gets a unique JTI (JWT ID) claim.
When a user logs out or an admin revokes access, the JTI is added to a
blacklist table. On each request, the blacklist is checked before granting access.
"""

import os
import hashlib
import secrets
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "advanced-rag-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

ROLE_HIERARCHY = {
    "guest": 0,
    "user": 1,
    "admin": 2,
    "super_admin": 3,
}

TOOL_PERMISSIONS = {
    "public_search": "guest",
    "internal_search": "user",
    "admin_search": "admin",
    "database_query": "super_admin",
}

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    """Create a JWT with a unique JTI for blacklist support."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": str(uuid.uuid4()),  # Unique token ID for blacklisting
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def is_token_blacklisted(jti: str) -> bool:
    """Check if a token's JTI has been blacklisted."""
    from auth_service.database import get_db
    conn = get_db()
    row = conn.execute("SELECT id FROM token_blacklist WHERE jti = ?", (jti,)).fetchone()
    conn.close()
    return row is not None


def blacklist_token(jti: str, expires_at: datetime):
    """Add a token's JTI to the blacklist."""
    from auth_service.database import get_db
    conn = get_db()
    conn.execute(
        "INSERT OR IGNORE INTO token_blacklist (jti, expires_at) VALUES (?, ?)",
        (jti, expires_at.isoformat())
    )
    conn.commit()
    conn.close()


def cleanup_expired_blacklist():
    """Remove expired entries from the blacklist (housekeeping)."""
    from auth_service.database import get_db
    conn = get_db()
    conn.execute("DELETE FROM token_blacklist WHERE expires_at < ?", (datetime.now(timezone.utc).isoformat(),))
    conn.commit()
    conn.close()


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        # Check blacklist
        jti = payload.get("jti")
        if jti and is_token_blacklisted(jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_available_tools(user_role: str) -> list[str]:
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    return [
        tool for tool, required_role in TOOL_PERMISSIONS.items()
        if ROLE_HIERARCHY.get(required_role, 0) <= user_level
    ]


def require_role(minimum_role: str):
    def role_checker(token: str = Depends(oauth2_scheme)):
        payload = decode_access_token(token)
        user_role = payload.get("role", "guest")
        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(minimum_role, 0):
            raise HTTPException(status_code=403, detail=f"Requires '{minimum_role}' role or higher")
        return payload
    return role_checker


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    return decode_access_token(token)
