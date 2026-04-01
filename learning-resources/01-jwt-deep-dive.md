# JWT (JSON Web Tokens) - Deep Dive

## What is JWT?

JSON Web Token (JWT) is an open standard (RFC 7519) for securely transmitting information between parties as a JSON object. JWTs are **self-contained** — the token itself carries all the information needed to verify identity and permissions, without requiring a database lookup on every request.

## JWT Structure

A JWT consists of three parts separated by dots (`.`):

```
xxxxx.yyyyy.zzzzz
  │      │      │
  │      │      └── Signature
  │      └── Payload
  └── Header
```

### 1. Header
The header typically consists of two parts: the token type (`JWT`) and the signing algorithm (`HS256`, `RS256`, etc.).

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

This JSON is **Base64Url** encoded to form the first part.

### 2. Payload (Claims)
The payload contains **claims** — statements about the user and additional metadata.

#### Registered Claims (Standard)
| Claim | Full Name | Description |
|-------|-----------|-------------|
| `iss` | Issuer | Who issued the token |
| `sub` | Subject | Who the token is about (usually user ID) |
| `aud` | Audience | Who the token is intended for |
| `exp` | Expiration | When the token expires (Unix timestamp) |
| `nbf` | Not Before | Token not valid before this time |
| `iat` | Issued At | When the token was issued |
| `jti` | JWT ID | Unique identifier for the token |

#### Custom Claims (Your App Data)
```json
{
  "sub": "user123",
  "username": "john_doe",
  "role": "admin",
  "permissions": ["read", "write", "delete"],
  "exp": 1700000000,
  "iat": 1699996400
}
```

### 3. Signature
The signature is created by combining the encoded header, encoded payload, and a secret:

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

## Signing Algorithms

### Symmetric (Shared Secret)
| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **HS256** | HMAC + SHA-256 | Single server, simple apps |
| **HS384** | HMAC + SHA-384 | Higher security needs |
| **HS512** | HMAC + SHA-512 | Maximum HMAC security |

**How it works:** Same secret key is used to both sign and verify the token.

```python
# Both signing and verification use the same key
SECRET_KEY = "my-secret-key"
token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
```

### Asymmetric (Public/Private Key Pair)
| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **RS256** | RSA + SHA-256 | Microservices, distributed systems |
| **RS384** | RSA + SHA-384 | Higher security distributed systems |
| **RS512** | RSA + SHA-512 | Maximum RSA security |
| **ES256** | ECDSA + P-256 | Mobile, IoT (smaller key size) |
| **PS256** | RSA-PSS + SHA-256 | Modern RSA alternative |

**How it works:** Private key signs the token, public key verifies it. Services only need the public key to verify.

```python
# Auth server signs with private key
token = jwt.encode(payload, private_key, algorithm="RS256")

# Any service verifies with public key (no secret needed!)
decoded = jwt.decode(token, public_key, algorithms=["RS256"])
```

**Why this matters for microservices:**
```
Auth Server (has private key) → signs tokens
  ↓
Resource Server A (has public key) → verifies tokens
Resource Server B (has public key) → verifies tokens
Resource Server C (has public key) → verifies tokens
```

## JWT Authentication Flow

```
┌──────────┐         ┌──────────────┐         ┌─────────────────┐
│  Client   │         │  Auth Server  │         │ Resource Server  │
└─────┬────┘         └──────┬───────┘         └────────┬────────┘
      │                     │                          │
      │ 1. POST /login      │                          │
      │  {user, password}   │                          │
      │────────────────────>│                          │
      │                     │                          │
      │                     │ 2. Validate credentials  │
      │                     │    Hash password check   │
      │                     │                          │
      │ 3. JWT Access Token │                          │
      │    + Refresh Token  │                          │
      │<────────────────────│                          │
      │                     │                          │
      │ 4. GET /api/data                               │
      │    Authorization: Bearer <access_token>        │
      │───────────────────────────────────────────────>│
      │                                                │
      │                     5. Verify JWT signature    │
      │                        Check expiration        │
      │                        Extract claims          │
      │                                                │
      │ 6. Response data (based on role/permissions)   │
      │<───────────────────────────────────────────────│
```

## Access Tokens vs Refresh Tokens

| Aspect | Access Token | Refresh Token |
|--------|-------------|---------------|
| **Purpose** | Authorize API requests | Get new access tokens |
| **Lifetime** | Short (15-60 min) | Long (7-30 days) |
| **Storage** | Memory / HTTP-only cookie | HTTP-only cookie / secure storage |
| **Sent with** | Every API request | Only to /refresh endpoint |
| **Contains** | User ID, role, permissions | User ID, token family |
| **Revocable** | Not easily (stateless) | Yes (stored in DB) |

### Token Refresh Flow
```
1. Access token expires
2. Client sends refresh token to /refresh endpoint
3. Server validates refresh token against DB
4. Server issues new access token + new refresh token
5. Old refresh token is invalidated (rotation)
```

## Security Best Practices

### Do's
- **Use HTTPS always** — JWTs are only encoded, not encrypted
- **Set short expiration** for access tokens (15-30 minutes)
- **Use refresh token rotation** — invalidate old refresh tokens
- **Store secrets in environment variables**, never in code
- **Validate all claims** — check `exp`, `iss`, `aud`
- **Use asymmetric keys (RS256)** for distributed systems
- **Use HTTP-only cookies** for token storage in browsers

### Don'ts
- **Don't store sensitive data** in JWT payload (it's readable by anyone!)
- **Don't use JWT for sessions** if you need server-side revocation
- **Don't use weak secrets** — minimum 256 bits for HS256
- **Don't skip expiration** — always set `exp` claim
- **Don't store tokens in localStorage** — vulnerable to XSS
- **Don't use `none` algorithm** — always validate algorithm

## Common Attacks and Mitigations

### 1. Algorithm Confusion Attack
**Attack:** Attacker changes `alg` header from RS256 to HS256, using the public key as the HMAC secret.
**Mitigation:** Always specify allowed algorithms explicitly:
```python
jwt.decode(token, key, algorithms=["RS256"])  # Not algorithms=["RS256", "HS256"]
```

### 2. Token Theft (XSS)
**Attack:** Malicious script reads token from localStorage.
**Mitigation:** Store in HTTP-only cookies with `SameSite=Strict`.

### 3. Brute Force Secret
**Attack:** Attacker tries to guess the HMAC secret key.
**Mitigation:** Use minimum 256-bit random secrets. Use asymmetric keys.

### 4. Token Replay
**Attack:** Attacker reuses a valid stolen token.
**Mitigation:** Short expiration, token binding, refresh token rotation.

## JWT in Python (FastAPI Example)

```python
import os
import bcrypt
import jwt  # PyJWT — the actively maintained JWT library
from datetime import datetime, timedelta, timezone

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return payload
    except jwt.ExpiredSignatureError:
        raise credentials_exception  # Token expired
    except jwt.InvalidTokenError:
        raise credentials_exception  # Invalid signature, malformed, etc.

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
```

> **Package note:** We use `PyJWT` (not `python-jose`, which is unmaintained) and `bcrypt` directly (not `passlib`, which has compatibility issues with modern bcrypt versions).

## JWT vs Other Auth Methods

| Feature | JWT | Session Cookies | API Keys | OAuth2 |
|---------|-----|----------------|----------|--------|
| Stateless | Yes | No (server-side) | Depends | Depends |
| Scalable | Excellent | Needs shared store | Excellent | Good |
| Revocable | Hard | Easy | Easy | Medium |
| Self-contained | Yes | No | No | Partially |
| Best for | SPAs, APIs, Microservices | Traditional web apps | Server-to-server | Third-party access |

## When to Use JWT

**Good fit:**
- Single Page Applications (SPAs)
- Mobile applications
- Microservice architectures
- Stateless API authentication
- Short-lived authorization

**Poor fit:**
- When you need instant token revocation
- Long-lived sessions
- Storing large amounts of user data
- When token size matters (cookies have 4KB limit)

## Further Reading
- [RFC 7519 - JSON Web Token](https://tools.ietf.org/html/rfc7519)
- [JWT.io Debugger](https://jwt.io)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
