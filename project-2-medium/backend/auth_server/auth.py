"""JWT + RBAC authentication using RS256 (asymmetric) and bcrypt.

RS256 flow:
  Auth Server  → signs tokens with PRIVATE key
  Resource Server → verifies tokens with PUBLIC key (cannot forge!)

This is the correct pattern for microservices — resource servers never
need the signing secret, only the public verification key.
"""

import hashlib
import secrets
import bcrypt
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from keys import load_private_key, load_public_key

ALGORITHM = "RS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Load RSA keys at module level
PRIVATE_KEY = load_private_key()
PUBLIC_KEY = load_public_key()

ROLE_HIERARCHY = {
    "user": 1,
    "admin": 2,
    "super_admin": 3,
}

# Account lockout settings
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    """Sign a JWT with the PRIVATE key (RS256)."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), "type": "access"})
    return jwt.encode(to_encode, PRIVATE_KEY, algorithm=ALGORITHM)


def create_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> dict:
    """Verify a JWT with the PUBLIC key (RS256)."""
    try:
        payload = jwt.decode(token, PUBLIC_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_role(minimum_role: str):
    """Dependency factory: require minimum role level."""
    def role_checker(token: str = Depends(oauth2_scheme)):
        payload = decode_access_token(token)
        user_role = payload.get("role", "user")
        if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(minimum_role, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum_role}' role or higher",
            )
        return payload
    return role_checker


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    return decode_access_token(token)
