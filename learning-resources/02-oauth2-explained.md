# OAuth 2.0 - Explained

## What is OAuth 2.0?

OAuth 2.0 is an **authorization framework** that allows third-party applications to access a user's resources without exposing their credentials. It's the standard behind "Login with Google/GitHub/Facebook" buttons.

**Key distinction:** OAuth is about **authorization** (what you can access), not **authentication** (who you are). OpenID Connect (OIDC) is the authentication layer built on top of OAuth 2.0.

## Core Concepts

### Roles
| Role | Description | Example |
|------|-------------|---------|
| **Resource Owner** | The user who owns the data | You (the end user) |
| **Client** | The app requesting access | Your web/mobile app |
| **Authorization Server** | Issues tokens after auth | Google's OAuth server |
| **Resource Server** | Hosts the protected data | Google Drive API |

### Tokens
| Token | Purpose | Lifetime |
|-------|---------|----------|
| **Authorization Code** | Exchanged for tokens (one-time use) | ~10 minutes |
| **Access Token** | Access protected resources | 1 hour typical |
| **Refresh Token** | Get new access tokens | Days to months |
| **ID Token** (OIDC) | User identity information | Same as access token |

## OAuth 2.0 Grant Types (Flows)

### 1. Authorization Code Flow (Most Common)
**Best for:** Web apps with a backend server

```
┌──────┐      ┌───────────┐      ┌────────────────┐      ┌──────────────┐
│ User │      │  Client   │      │  Auth Server   │      │ Resource API │
│      │      │  (Your    │      │  (Google,      │      │ (Google      │
│      │      │   App)    │      │   GitHub)      │      │  Drive API)  │
└──┬───┘      └─────┬─────┘      └───────┬────────┘      └──────┬───────┘
   │                │                     │                      │
   │ 1. Click       │                     │                      │
   │ "Login with    │                     │                      │
   │  Google"       │                     │                      │
   │───────────────>│                     │                      │
   │                │                     │                      │
   │                │ 2. Redirect to      │                      │
   │                │    auth endpoint    │                      │
   │<───────────────│  /authorize?        │                      │
   │                │  client_id=xxx&     │                      │
   │                │  redirect_uri=xxx&  │                      │
   │                │  scope=read&        │                      │
   │                │  state=random       │                      │
   │                │                     │                      │
   │ 3. Login & consent page             │                      │
   │─────────────────────────────────────>│                      │
   │                                      │                      │
   │ 4. Redirect back with auth code     │                      │
   │<─────────────────────────────────────│                      │
   │  /callback?code=AUTH_CODE&state=xxx  │                      │
   │                │                     │                      │
   │───────────────>│                     │                      │
   │                │ 5. Exchange code    │                      │
   │                │    for tokens       │                      │
   │                │    POST /token      │                      │
   │                │    {code, secret}   │                      │
   │                │────────────────────>│                      │
   │                │                     │                      │
   │                │ 6. Access + Refresh │                      │
   │                │    tokens           │                      │
   │                │<────────────────────│                      │
   │                │                     │                      │
   │                │ 7. GET /api/data                           │
   │                │    Authorization: Bearer <token>           │
   │                │──────────────────────────────────────────>│
   │                │                                            │
   │                │ 8. Protected data                          │
   │                │<──────────────────────────────────────────│
```

### 2. Authorization Code + PKCE (Proof Key for Code Exchange)
**Best for:** SPAs, mobile apps (no client secret)

Adds a `code_verifier` and `code_challenge` to prevent authorization code interception.

```python
import hashlib, base64, secrets

# Client generates these BEFORE starting the flow
code_verifier = secrets.token_urlsafe(64)  # Random string
code_challenge = base64.urlsafe_b64encode(
    hashlib.sha256(code_verifier.encode()).digest()
).rstrip(b'=').decode()

# Step 2: Include code_challenge in /authorize request
# Step 5: Include code_verifier in /token request
# Server verifies: SHA256(code_verifier) == code_challenge
```

### 3. Client Credentials Flow
**Best for:** Machine-to-machine (M2M), service accounts, no user involved

```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET&
scope=read:data
```

### 4. Device Authorization Flow
**Best for:** Smart TVs, CLI tools, IoT devices (limited input)

```
1. Device requests a device code
2. User goes to a URL on their phone/computer
3. User enters the code and authorizes
4. Device polls for token until authorized
```

## Scopes

Scopes define **what** the client can access. They are space-separated strings.

```
scope=openid profile email read:repos write:repos
```

| Scope | Access Granted |
|-------|---------------|
| `openid` | User's unique ID (OIDC) |
| `profile` | Name, picture, etc. |
| `email` | Email address |
| `read:repos` | Read repository data |
| `write:repos` | Modify repositories |

## OAuth 2.0 in FastAPI

```python
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2AuthorizationCodeBearer
import httpx

app = FastAPI()

oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl="https://accounts.google.com/o/oauth2/auth",
    tokenUrl="https://oauth2.googleapis.com/token",
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

@app.get("/login")
async def login():
    """Redirect user to Google's consent page"""
    return RedirectResponse(
        f"https://accounts.google.com/o/oauth2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri=http://localhost:8000/callback&"
        f"response_type=code&"
        f"scope=openid email profile"
    )

@app.get("/callback")
async def callback(code: str):
    """Exchange auth code for tokens"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": "http://localhost:8000/callback",
                "grant_type": "authorization_code",
            }
        )
    tokens = response.json()
    access_token = tokens["access_token"]
    # Use access_token to fetch user info, create session, etc.
    return {"access_token": access_token}
```

## OAuth 2.0 vs OAuth 1.0

| Feature | OAuth 1.0 | OAuth 2.0 |
|---------|-----------|-----------|
| Signatures | Required (complex) | Not required (uses HTTPS) |
| Token types | One token type | Access + Refresh tokens |
| Flows | One flow | Multiple grant types |
| Complexity | High | Lower |
| Mobile support | Poor | Excellent |

## Security Considerations

- **Always use HTTPS** — tokens travel in headers
- **Validate `state` parameter** — prevents CSRF attacks
- **Use PKCE** for public clients (SPAs, mobile)
- **Store tokens securely** — HTTP-only cookies, not localStorage
- **Implement token rotation** for refresh tokens
- **Validate redirect URIs** — exact match, no wildcards
- **Keep scopes minimal** — request only what you need

## When to Use OAuth 2.0

**Good fit:**
- Third-party login (Social login)
- API access delegation
- Microservice authorization
- Mobile app authentication

**Poor fit:**
- Simple internal APIs (use JWT or API keys)
- Server-to-server with full trust (use mutual TLS)
- When you don't need third-party access
