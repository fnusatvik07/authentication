"""Project 2: Resource Server — verifies RS256 JWTs with PUBLIC key only.

Runs on port 8001.
The resource server NEVER has the private key — it can only verify tokens,
not forge them. This is the key security advantage of RS256 over HS256.

On startup, it fetches the public key from the auth server's /api/public-key
endpoint, or loads it from the shared jwt_keys/ directory.
"""

from contextlib import asynccontextmanager
from pathlib import Path

import jwt
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from database import init_db, get_db

ALGORITHM = "RS256"
ROLE_HIERARCHY = {"user": 1, "admin": 2, "super_admin": 3}
ACCESS_LEVEL_TO_ROLE = {"public": 0, "user": 1, "admin": 2, "super_admin": 3}

# Load the public key from the auth server's key directory
PUBLIC_KEY_PATH = Path(__file__).parent.parent / "auth_server" / "jwt_keys" / "public.pem"
_public_key = None


def get_public_key() -> bytes:
    """Load the RSA public key for verifying tokens."""
    global _public_key
    if _public_key is None:
        if PUBLIC_KEY_PATH.exists():
            _public_key = PUBLIC_KEY_PATH.read_bytes()
        else:
            raise RuntimeError(
                f"Public key not found at {PUBLIC_KEY_PATH}. "
                "Run the auth server first to generate keys, or run: "
                "cd ../auth_server && python keys.py"
            )
    return _public_key


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://localhost:8000/api/login")


class ResourceCreate(BaseModel):
    title: str
    content: str
    access_level: str = "public"
    category: str = "general"


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Verify JWT using the PUBLIC key only — cannot forge tokens."""
    try:
        payload = jwt.decode(token, get_public_key(), algorithms=[ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_accessible_levels(user_role: str) -> list[str]:
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    return [level for level, req in ACCESS_LEVEL_TO_ROLE.items() if req <= user_level]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Verify public key is accessible
    get_public_key()
    yield

app = FastAPI(title="Project 2: Resource Server (RS256)", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/resources")
def list_resources(
    category: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    user_role = current_user.get("role", "user")
    accessible = get_accessible_levels(user_role)

    conn = get_db()
    placeholders = ",".join("?" * len(accessible))
    query = f"SELECT id, title, content, access_level, category, created_at FROM resources WHERE access_level IN ({placeholders})"
    params = list(accessible)

    if category:
        query += " AND category = ?"
        params.append(category)

    query += " ORDER BY created_at DESC"
    resources = conn.execute(query, params).fetchall()
    conn.close()

    return {
        "user": current_user.get("sub"),
        "role": user_role,
        "accessible_levels": accessible,
        "count": len(resources),
        "resources": [dict(r) for r in resources],
    }


@app.get("/api/resources/{resource_id}")
def get_resource(resource_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db()
    resource = conn.execute("SELECT * FROM resources WHERE id = ?", (resource_id,)).fetchone()
    conn.close()

    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    user_role = current_user.get("role", "user")
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ACCESS_LEVEL_TO_ROLE.get(resource["access_level"], 0)

    if user_level < required_level:
        raise HTTPException(status_code=403, detail="Insufficient permissions for this resource")

    return dict(resource)


@app.post("/api/resources", status_code=201)
def create_resource(resource: ResourceCreate, current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role", "user")
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    resource_level = ACCESS_LEVEL_TO_ROLE.get(resource.access_level, 0)

    if resource_level > user_level:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot create resource with access_level '{resource.access_level}' — your role is '{user_role}'"
        )

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO resources (title, content, access_level, category, created_by) VALUES (?, ?, ?, ?, ?)",
        (resource.title, resource.content, resource.access_level, resource.category, current_user.get("sub"))
    )
    conn.commit()
    new = conn.execute("SELECT * FROM resources WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(new)


@app.get("/api/categories")
def list_categories(current_user: dict = Depends(get_current_user)):
    user_role = current_user.get("role", "user")
    accessible = get_accessible_levels(user_role)
    placeholders = ",".join("?" * len(accessible))

    conn = get_db()
    categories = conn.execute(
        f"SELECT DISTINCT category, COUNT(*) as count FROM resources WHERE access_level IN ({placeholders}) GROUP BY category",
        accessible
    ).fetchall()
    conn.close()
    return [dict(c) for c in categories]


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "resource-server", "algorithm": "RS256"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
