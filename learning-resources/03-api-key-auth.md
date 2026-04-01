# API Key Authentication

## What are API Keys?

API keys are unique identifiers (long random strings) assigned to a client application. They are the simplest form of API authentication — include the key in your request, and the server looks it up to identify and authorize you.

```
GET /api/data
X-API-Key: sk-proj-abc123def456...
```

## How API Keys Work

```
┌──────────┐                    ┌──────────────┐                ┌──────────┐
│  Client   │                    │   API Server  │                │ Database │
└─────┬────┘                    └──────┬───────┘                └────┬─────┘
      │                                │                             │
      │ 1. Request + API Key           │                             │
      │    X-API-Key: sk-xxx           │                             │
      │───────────────────────────────>│                             │
      │                                │                             │
      │                                │ 2. Look up key              │
      │                                │────────────────────────────>│
      │                                │                             │
      │                                │ 3. Return client info       │
      │                                │    + permissions            │
      │                                │<────────────────────────────│
      │                                │                             │
      │                                │ 4. Check rate limits        │
      │                                │    + permissions            │
      │                                │                             │
      │ 5. Response                    │                             │
      │<───────────────────────────────│                             │
```

## API Key Patterns

### Where to Send the Key

| Method | Example | Pros | Cons |
|--------|---------|------|------|
| **Header** (recommended) | `X-API-Key: sk-xxx` | Not in URL/logs | Requires header support |
| **Query parameter** | `?api_key=sk-xxx` | Simple, works everywhere | Logged in server/proxy logs |
| **Bearer token** | `Authorization: Bearer sk-xxx` | Standard header | Can confuse with JWT |

### Key Format Conventions

```
# Prefix-based (identifies key type)
sk-proj-abc123...     # OpenAI style (secret key, project-scoped)
tvly-abc123...        # Tavily style (service prefix)
pk_live_abc123...     # Stripe style (public key, live mode)
sk_test_abc123...     # Stripe style (secret key, test mode)

# Hash-based
dtn_cc5607ee1025...   # Daytona style (service + hash)
```

**Why prefixes matter:** They help identify leaked keys in code scanning tools and make it clear what the key is for.

## Implementation in FastAPI

```python
from fastapi import FastAPI, Security, HTTPException, Depends
from fastapi.security import APIKeyHeader
import hashlib
import secrets
import sqlite3

app = FastAPI()
api_key_header = APIKeyHeader(name="X-API-Key")

def generate_api_key(prefix: str = "sk") -> str:
    """Generate a new API key with prefix."""
    random_part = secrets.token_hex(32)
    return f"{prefix}-{random_part}"

def hash_api_key(key: str) -> str:
    """Hash API key for storage (never store plaintext!)."""
    return hashlib.sha256(key.encode()).hexdigest()

async def verify_api_key(api_key: str = Security(api_key_header)):
    """Dependency that validates API key."""
    key_hash = hash_api_key(api_key)
    conn = sqlite3.connect("keys.db")
    cursor = conn.execute(
        "SELECT client_name, permissions, rate_limit FROM api_keys WHERE key_hash = ? AND is_active = 1",
        (key_hash,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return {"client": row[0], "permissions": row[1], "rate_limit": row[2]}

@app.get("/api/data")
async def get_data(client=Depends(verify_api_key)):
    return {"message": f"Hello {client['client']}", "data": "..."}
```

## API Key vs JWT vs OAuth

| Feature | API Key | JWT | OAuth 2.0 |
|---------|---------|-----|-----------|
| Complexity | Low | Medium | High |
| Stateless | No (DB lookup) | Yes | Depends |
| User identity | No (identifies app) | Yes | Yes |
| Expiration | Manual/admin | Built-in | Built-in |
| Scoping | Custom | Claims | Scopes |
| Revocation | Easy (DB flag) | Hard | Medium |
| Best for | Server-to-server, developer APIs | User auth, SPAs | Third-party access |

## Security Best Practices

1. **Never store API keys in plaintext** — store only the hash
2. **Use HTTPS always** — keys travel in headers
3. **Implement rate limiting** — per key
4. **Allow key rotation** — users should be able to regenerate keys
5. **Set key expiration** — don't let keys live forever
6. **Use key prefixes** — makes leaked keys identifiable
7. **Scope keys** — limit what each key can access
8. **Monitor usage** — alert on anomalous patterns
9. **Never embed keys in client-side code** — they're server-side only

## When to Use API Keys

**Good fit:**
- Server-to-server communication
- Public developer APIs (OpenAI, Stripe, Twilio)
- Internal service mesh
- Rate limiting and usage tracking

**Poor fit:**
- User-facing authentication (use JWT/OAuth)
- Browser/mobile apps (key can be extracted)
- When you need fine-grained user permissions
