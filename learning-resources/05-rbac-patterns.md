# Role-Based Access Control (RBAC) Patterns

## What is RBAC?

Role-Based Access Control assigns permissions to **roles**, not directly to users. Users are assigned roles, and inherit the permissions of those roles. This simplifies permission management at scale.

```
Users ──> Roles ──> Permissions ──> Resources
```

## RBAC Models

### Level 1: Flat RBAC
Simple role assignment — each user has one or more roles.

```
User: Alice    → Role: admin    → Permissions: [read, write, delete]
User: Bob      → Role: user     → Permissions: [read]
User: Charlie  → Role: editor   → Permissions: [read, write]
```

### Level 2: Hierarchical RBAC
Roles inherit permissions from lower-level roles.

```
super_admin (inherits all below)
    └── admin (inherits all below)
        └── editor (inherits all below)
            └── user (base permissions)
                └── guest (minimal permissions)
```

```python
ROLE_HIERARCHY = {
    "guest": 0,
    "user": 1,
    "editor": 2,
    "admin": 3,
    "super_admin": 4,
}

def has_access(user_role: str, required_role: str) -> bool:
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)
```

### Level 3: Attribute-Based RBAC (ABAC hybrid)
Combines roles with resource attributes for fine-grained control.

```python
# Access decision considers: role + resource attributes + context
def can_access(user, resource, action):
    # Role check
    if user.role not in resource.allowed_roles:
        return False
    # Attribute check (e.g., department match)
    if resource.department and user.department != resource.department:
        return False
    # Context check (e.g., time-based)
    if resource.business_hours_only and not is_business_hours():
        return False
    return True
```

## Database Schema for RBAC

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    department TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- For more complex RBAC: many-to-many roles
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    level INTEGER NOT NULL,  -- hierarchy level
    description TEXT
);

CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,  -- e.g., "documents:read", "users:delete"
    description TEXT
);

CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id),
    permission_id INTEGER REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id),
    role_id INTEGER REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- Resources with access levels
CREATE TABLE resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    access_level TEXT NOT NULL DEFAULT 'public',  -- public, user, admin, super_admin
    department TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## RBAC in FastAPI

```python
from functools import wraps
from fastapi import Depends, HTTPException

ROLE_HIERARCHY = {"guest": 0, "user": 1, "editor": 2, "admin": 3, "super_admin": 4}

def require_role(minimum_role: str):
    """Dependency that enforces minimum role level."""
    def role_checker(current_user = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(current_user["role"], 0)
        required_level = ROLE_HIERARCHY.get(minimum_role, 0)
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{minimum_role}' or higher required"
            )
        return current_user
    return role_checker

# Usage in endpoints
@app.get("/public")
async def public_data():
    """Anyone can access."""
    return {"data": "public info"}

@app.get("/user-data")
async def user_data(user=Depends(require_role("user"))):
    """Authenticated users and above."""
    return {"data": "user-level info"}

@app.get("/admin-panel")
async def admin_panel(user=Depends(require_role("admin"))):
    """Admins and super admins only."""
    return {"data": "admin-level info"}

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, user=Depends(require_role("super_admin"))):
    """Super admins only."""
    return {"message": f"User {user_id} deleted"}
```

## RBAC in RAG Systems

In RAG (Retrieval-Augmented Generation) systems, RBAC controls:
1. **Which documents** a user can search
2. **Which tools** the agent can use on behalf of a user
3. **What data** appears in the generated response

```python
# Each search tool is gated by role
TOOL_PERMISSIONS = {
    "public_search": "guest",       # Public knowledge base
    "internal_search": "user",      # Internal docs
    "admin_search": "admin",        # Admin docs, configs
    "sql_query": "super_admin",     # Direct DB access
}

def get_available_tools(user_role: str) -> list:
    """Return tools available for the user's role level."""
    user_level = ROLE_HIERARCHY[user_role]
    return [
        tool for tool, required_role in TOOL_PERMISSIONS.items()
        if ROLE_HIERARCHY[required_role] <= user_level
    ]

# guest  → ["public_search"]
# user   → ["public_search", "internal_search"]
# admin  → ["public_search", "internal_search", "admin_search"]
# super_admin → all tools
```

## Common RBAC Pitfalls

1. **Role explosion** — too many fine-grained roles. Keep it simple.
2. **Hardcoded roles** — use a database, not if/else chains.
3. **Missing resource-level checks** — role check alone isn't enough if users should only see their own data.
4. **No audit trail** — log who accessed what and when.
5. **Overly permissive defaults** — default to least privilege.

## Best Practices

- **Principle of least privilege** — start with minimal access, add as needed
- **Use hierarchical roles** — avoid permission duplication
- **Separate authentication from authorization** — verify identity first, then check permissions
- **Cache role lookups** — don't hit the DB on every request
- **Implement audit logging** — track all access decisions
- **Review roles periodically** — remove stale permissions
