"""Comprehensive tests for Project 2: RS256 RBAC Multi-Server Authentication.

Tests cover:
- Unit tests: RBAC role hierarchy, RS256 token creation, refresh token hashing
- Integration tests: Auth server endpoints (register, login, refresh, roles, user management)
- Integration tests: Account lockout, password reset flow
- Integration tests: Resource server endpoints (RBAC-filtered resources with RS256 verification)
- E2E tests: Full multi-role flows, token refresh rotation, role upgrades
"""

import sys
import sqlite3
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
import jwt as pyjwt

import database as auth_db
auth_db.DB_PATH = Path(__file__).parent / "test_users.db"

from auth import (
    hash_password, create_access_token,
    create_refresh_token, hash_refresh_token, decode_access_token,
    require_role, ROLE_HIERARCHY, PUBLIC_KEY, ALGORITHM,
)

from main import app as auth_app
auth_client = TestClient(auth_app)

# Resource server test DB path
res_db_path = Path(__file__).parent / "test_resources.db"

# Build resource database inline (avoids module name collision)
def init_resource_db():
    conn = sqlite3.connect(str(res_db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            access_level TEXT NOT NULL DEFAULT 'public',
            category TEXT,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    # Seed data
    count = conn.execute("SELECT COUNT(*) FROM resources").fetchone()[0]
    if count == 0:
        seed_data = [
            ("Company Overview", "Public company info.", "public", "general"),
            ("Product Catalog", "Our products.", "public", "general"),
            ("Public API Docs", "REST API docs.", "public", "technical"),
            ("Employee Handbook", "Work hours 9-5.", "user", "hr"),
            ("Team Directory", "Engineering: 50 people.", "user", "hr"),
            ("Internal Roadmap", "Q2: Launch vector search.", "user", "product"),
            ("Security Policies", "All endpoints use JWT.", "admin", "security"),
            ("Incident Playbook", "Step 1: Identify.", "admin", "security"),
            ("Infra Costs", "AWS: $50k/mo.", "admin", "finance"),
            ("Board Meeting Notes", "Revenue grew 40% YoY.", "super_admin", "executive"),
            ("Salary Bands", "L5: $180-220k.", "super_admin", "hr"),
        ]
        conn.executemany(
            "INSERT INTO resources (title, content, access_level, category) VALUES (?, ?, ?, ?)",
            seed_data,
        )
        conn.commit()
    conn.close()


def get_res_db():
    conn = sqlite3.connect(str(res_db_path))
    conn.row_factory = sqlite3.Row
    return conn


# Now build a minimal resource server for testing using the same logic
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

res_app = FastAPI()
res_oauth2 = OAuth2PasswordBearer(tokenUrl="http://localhost:8000/api/login")

ACCESS_LEVEL_TO_ROLE = {"public": 0, "user": 1, "admin": 2, "super_admin": 3}


class ResourceCreate(BaseModel):
    title: str
    content: str
    access_level: str = "public"
    category: str = "general"


def res_get_user(token: str = Depends(res_oauth2)):
    try:
        return pyjwt.decode(token, PUBLIC_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401)


def get_accessible_levels(role: str):
    level = ROLE_HIERARCHY.get(role, 0)
    return [lv for lv, req in ACCESS_LEVEL_TO_ROLE.items() if req <= level]


@res_app.get("/api/resources")
def list_resources(category: str | None = Query(None), user=Depends(res_get_user)):
    role = user.get("role", "user")
    accessible = get_accessible_levels(role)
    conn = get_res_db()
    ph = ",".join("?" * len(accessible))
    q = f"SELECT id, title, content, access_level, category, created_at FROM resources WHERE access_level IN ({ph})"
    params = list(accessible)
    if category:
        q += " AND category = ?"
        params.append(category)
    q += " ORDER BY created_at DESC"
    resources = conn.execute(q, params).fetchall()
    conn.close()
    return {
        "user": user.get("sub"), "role": role, "accessible_levels": accessible,
        "count": len(resources), "resources": [dict(r) for r in resources],
    }


@res_app.get("/api/resources/{rid}")
def get_resource(rid: int, user=Depends(res_get_user)):
    conn = get_res_db()
    r = conn.execute("SELECT * FROM resources WHERE id = ?", (rid,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(status_code=404)
    role = user.get("role", "user")
    if ROLE_HIERARCHY.get(role, 0) < ACCESS_LEVEL_TO_ROLE.get(r["access_level"], 0):
        raise HTTPException(status_code=403)
    return dict(r)


@res_app.post("/api/resources", status_code=201)
def create_resource(resource: ResourceCreate, user=Depends(res_get_user)):
    role = user.get("role", "user")
    if ACCESS_LEVEL_TO_ROLE.get(resource.access_level, 0) > ROLE_HIERARCHY.get(role, 0):
        raise HTTPException(status_code=403)
    conn = get_res_db()
    cursor = conn.execute(
        "INSERT INTO resources (title, content, access_level, category, created_by) VALUES (?, ?, ?, ?, ?)",
        (resource.title, resource.content, resource.access_level, resource.category, user.get("sub")),
    )
    conn.commit()
    new = conn.execute("SELECT * FROM resources WHERE id = ?", (cursor.lastrowid,)).fetchone()
    conn.close()
    return dict(new)


@res_app.get("/api/categories")
def list_categories(user=Depends(res_get_user)):
    role = user.get("role", "user")
    accessible = get_accessible_levels(role)
    ph = ",".join("?" * len(accessible))
    conn = get_res_db()
    cats = conn.execute(
        f"SELECT DISTINCT category, COUNT(*) as count FROM resources WHERE access_level IN ({ph}) GROUP BY category",
        accessible,
    ).fetchall()
    conn.close()
    return [dict(c) for c in cats]


res_client = TestClient(res_app)


# ──────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────

_admin_hash = None

def _get_admin_hash():
    global _admin_hash
    if _admin_hash is None:
        _admin_hash = hash_password("admin123")
    return _admin_hash

@pytest.fixture(autouse=True)
def clean_db():
    """Reset both databases before each test."""
    for p in [auth_db.DB_PATH, res_db_path]:
        if p.exists():
            p.unlink()
    # Init tables first
    auth_db.init_db()
    init_resource_db()
    # Then seed admin account
    conn = auth_db.get_db()
    conn.execute(
        "INSERT OR IGNORE INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
        ("admin", "admin@example.com", _get_admin_hash(), "super_admin"),
    )
    conn.commit()
    conn.close()
    yield
    for p in [auth_db.DB_PATH, res_db_path]:
        if p.exists():
            p.unlink()


def register(username="testuser", email="test@test.com", password="Test123"):
    return auth_client.post("/api/register", json={
        "username": username, "email": email, "password": password,
    })


def login(username="testuser", password="Test123"):
    return auth_client.post("/api/login", json={
        "username": username, "password": password,
    })


def get_admin_token():
    return auth_client.post("/api/login", json={
        "username": "admin", "password": "admin123",
    }).json()["access_token"]


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════
# UNIT TESTS
# ══════════════════════════════════════════════════════

class TestRoleHierarchy:

    def test_role_levels_ordered(self):
        assert ROLE_HIERARCHY["user"] < ROLE_HIERARCHY["admin"]
        assert ROLE_HIERARCHY["admin"] < ROLE_HIERARCHY["super_admin"]

    def test_all_roles_defined(self):
        for role in ["user", "admin", "super_admin"]:
            assert role in ROLE_HIERARCHY

    def test_role_check_higher_allows(self):
        token = create_access_token({"sub": "admin", "role": "super_admin", "user_id": 1})
        result = require_role("user")(token=token)
        assert result["role"] == "super_admin"

    def test_role_check_lower_denies(self):
        token = create_access_token({"sub": "user1", "role": "user", "user_id": 2})
        with pytest.raises(Exception):
            require_role("admin")(token=token)

    def test_role_check_exact_match(self):
        token = create_access_token({"sub": "a1", "role": "admin", "user_id": 3})
        result = require_role("admin")(token=token)
        assert result["role"] == "admin"


class TestRefreshTokens:

    def test_refresh_token_uniqueness(self):
        assert create_refresh_token() != create_refresh_token()

    def test_refresh_token_length(self):
        assert len(create_refresh_token()) > 40

    def test_hash_deterministic(self):
        assert hash_refresh_token("t1") == hash_refresh_token("t1")

    def test_hash_unique_per_input(self):
        assert hash_refresh_token("a") != hash_refresh_token("b")


class TestAccessTokenClaims:

    def test_token_includes_role(self):
        token = create_access_token({"sub": "u", "role": "admin", "user_id": 1})
        assert decode_access_token(token)["role"] == "admin"

    def test_token_type_claim(self):
        token = create_access_token({"sub": "u", "role": "user", "user_id": 1})
        payload = pyjwt.decode(token, PUBLIC_KEY, algorithms=[ALGORITHM])
        assert payload["type"] == "access"

    def test_token_has_expiry(self):
        token = create_access_token({"sub": "u", "role": "user", "user_id": 1})
        assert "exp" in decode_access_token(token)


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS - AUTH SERVER
# ══════════════════════════════════════════════════════

class TestAuthRegister:

    def test_register_default_role_is_user(self):
        res = register()
        assert res.status_code == 201
        assert res.json()["role"] == "user"

    def test_register_cannot_self_assign_admin(self):
        res = auth_client.post("/api/register", json={
            "username": "h", "email": "h@h.com", "password": "t", "role": "admin",
        })
        assert res.status_code == 403

    def test_register_cannot_self_assign_super_admin(self):
        res = auth_client.post("/api/register", json={
            "username": "h", "email": "h@h.com", "password": "t", "role": "super_admin",
        })
        assert res.status_code == 403

    def test_register_duplicate_rejected(self):
        register()
        assert register().status_code == 400


class TestAuthLogin:

    def test_login_returns_both_tokens(self):
        register()
        res = login()
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_token_contains_role(self):
        register()
        token = login().json()["access_token"]
        payload = pyjwt.decode(token, PUBLIC_KEY, algorithms=[ALGORITHM])
        assert payload["role"] == "user"

    def test_login_deactivated_user(self):
        register()
        conn = auth_db.get_db()
        conn.execute("UPDATE users SET is_active = 0 WHERE username = 'testuser'")
        conn.commit()
        conn.close()
        res = login()
        assert res.status_code == 403

    def test_seeded_admin_can_login(self):
        res = auth_client.post("/api/login", json={"username": "admin", "password": "admin123"})
        assert res.status_code == 200


class TestAccountLockout:

    def test_locks_after_max_failed_attempts(self):
        register()
        for _ in range(5):
            login(password="wrong")
        res = login()
        assert res.status_code == 423
        assert "locked" in res.json()["detail"].lower()

    def test_correct_login_resets_counter(self):
        register()
        login(password="wrong")
        login(password="wrong")
        res = login()
        assert res.status_code == 200
        # Counter reset — need 5 more failures to lock again
        for _ in range(4):
            login(password="wrong")
        res = login()
        assert res.status_code == 200

    def test_login_shows_remaining_attempts(self):
        register()
        res = login(password="wrong")
        assert res.status_code == 401
        assert "remaining" in res.json()["detail"].lower()


class TestPasswordReset:

    def test_request_reset_returns_token(self):
        register()
        res = auth_client.post("/api/password-reset/request", json={"email": "test@test.com"})
        assert res.status_code == 200
        assert "_debug_reset_token" in res.json()

    def test_request_reset_unknown_email_no_error(self):
        """Should not reveal whether email exists."""
        res = auth_client.post("/api/password-reset/request", json={"email": "nonexistent@test.com"})
        assert res.status_code == 200
        assert "_debug_reset_token" not in res.json()

    def test_reset_password_flow(self):
        """Full flow: request reset → use token → login with new password."""
        register()
        # Request reset
        res = auth_client.post("/api/password-reset/request", json={"email": "test@test.com"})
        reset_token = res.json()["_debug_reset_token"]

        # Confirm reset
        res = auth_client.post("/api/password-reset/confirm", json={
            "reset_token": reset_token, "new_password": "NewPass456",
        })
        assert res.status_code == 200

        # Old password fails
        res = login(password="Test123")
        assert res.status_code == 401

        # New password works
        res = login(password="NewPass456")
        assert res.status_code == 200

    def test_reset_token_single_use(self):
        register()
        res = auth_client.post("/api/password-reset/request", json={"email": "test@test.com"})
        reset_token = res.json()["_debug_reset_token"]

        # First use works
        auth_client.post("/api/password-reset/confirm", json={
            "reset_token": reset_token, "new_password": "New1",
        })

        # Second use fails
        res = auth_client.post("/api/password-reset/confirm", json={
            "reset_token": reset_token, "new_password": "New2",
        })
        assert res.status_code == 400
        assert "already used" in res.json()["detail"].lower()

    def test_invalid_reset_token(self):
        res = auth_client.post("/api/password-reset/confirm", json={
            "reset_token": "invalid", "new_password": "x",
        })
        assert res.status_code == 400

    def test_reset_clears_lockout(self):
        """Password reset should also clear account lockout."""
        register()
        # Lock the account
        for _ in range(5):
            login(password="wrong")
        assert login().status_code == 423

        # Reset password
        res = auth_client.post("/api/password-reset/request", json={"email": "test@test.com"})
        reset_token = res.json()["_debug_reset_token"]
        auth_client.post("/api/password-reset/confirm", json={
            "reset_token": reset_token, "new_password": "Unlocked1",
        })

        # Account should be unlocked
        res = login(password="Unlocked1")
        assert res.status_code == 200


class TestRS256:

    def test_token_uses_rs256_algorithm(self):
        register()
        token = login().json()["access_token"]
        # Decode header without verification to check algorithm
        header = pyjwt.get_unverified_header(token)
        assert header["alg"] == "RS256"

    def test_token_verifiable_with_public_key(self):
        register()
        token = login().json()["access_token"]
        payload = pyjwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
        assert payload["sub"] == "testuser"

    def test_public_key_endpoint(self):
        res = auth_client.get("/api/public-key")
        assert res.status_code == 200
        data = res.json()
        assert "BEGIN PUBLIC KEY" in data["public_key"]
        assert data["algorithm"] == "RS256"


class TestTokenRefresh:

    def test_refresh_returns_new_tokens(self):
        register()
        tokens = login().json()
        res = auth_client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert res.status_code == 200
        new = res.json()
        # Refresh token must be different (rotation)
        assert new["refresh_token"] != tokens["refresh_token"]

    def test_refresh_old_token_revoked(self):
        register()
        tokens = login().json()
        auth_client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]})
        res = auth_client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert res.status_code == 401

    def test_refresh_invalid_token(self):
        res = auth_client.post("/api/refresh", json={"refresh_token": "invalid"})
        assert res.status_code == 401

    def test_refresh_preserves_role(self):
        register()
        tokens = login().json()
        new = auth_client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]}).json()
        payload = pyjwt.decode(new["access_token"], PUBLIC_KEY, algorithms=[ALGORITHM])
        assert payload["role"] == "user"


class TestUserManagement:

    def test_list_users_requires_admin(self):
        register()
        token = login().json()["access_token"]
        assert auth_client.get("/api/users", headers=hdr(token)).status_code == 403

    def test_list_users_as_admin(self):
        res = auth_client.get("/api/users", headers=hdr(get_admin_token()))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_update_role_requires_super_admin(self):
        token = create_access_token({"sub": "a", "role": "admin", "user_id": 99})
        res = auth_client.put("/api/users/1/role", json={"role": "admin"}, headers=hdr(token))
        assert res.status_code == 403

    def test_update_role_as_super_admin(self):
        register()
        admin_token = get_admin_token()
        users = auth_client.get("/api/users", headers=hdr(admin_token)).json()
        tu = next(u for u in users if u["username"] == "testuser")
        res = auth_client.put(f"/api/users/{tu['id']}/role", json={"role": "admin"}, headers=hdr(admin_token))
        assert res.status_code == 200
        assert res.json()["role"] == "admin"

    def test_update_role_invalid(self):
        res = auth_client.put("/api/users/1/role", json={"role": "god"}, headers=hdr(get_admin_token()))
        assert res.status_code == 400


class TestLogout:

    def test_logout_revokes_refresh(self):
        register()
        tokens = login().json()
        auth_client.post("/api/logout", json={"refresh_token": tokens["refresh_token"]})
        res = auth_client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert res.status_code == 401


class TestRolesEndpoint:

    def test_list_roles(self):
        res = auth_client.get("/api/roles")
        assert res.status_code == 200
        roles = res.json()["roles"]
        assert "user" in roles and "admin" in roles and "super_admin" in roles


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS - RESOURCE SERVER (RBAC)
# ══════════════════════════════════════════════════════

class TestResourceAccess:

    def _token(self, role):
        return create_access_token({"sub": f"{role}_u", "role": role, "user_id": 1})

    def test_user_sees_public_and_user_only(self):
        res = res_client.get("/api/resources", headers=hdr(self._token("user")))
        assert res.status_code == 200
        data = res.json()
        levels = set(data["accessible_levels"])
        assert levels == {"public", "user"}
        for r in data["resources"]:
            assert r["access_level"] in ["public", "user"]

    def test_admin_sees_up_to_admin(self):
        res = res_client.get("/api/resources", headers=hdr(self._token("admin")))
        levels = set(res.json()["accessible_levels"])
        assert "admin" in levels and "public" in levels and "user" in levels
        assert "super_admin" not in levels

    def test_super_admin_sees_everything(self):
        res = res_client.get("/api/resources", headers=hdr(self._token("super_admin")))
        levels = set(res.json()["accessible_levels"])
        assert levels == {"public", "user", "admin", "super_admin"}

    def test_user_cannot_access_admin_resource(self):
        conn = get_res_db()
        admin_res = conn.execute("SELECT id FROM resources WHERE access_level = 'admin'").fetchone()
        conn.close()
        res = res_client.get(f"/api/resources/{admin_res['id']}", headers=hdr(self._token("user")))
        assert res.status_code == 403

    def test_admin_can_access_admin_resource(self):
        conn = get_res_db()
        admin_res = conn.execute("SELECT id FROM resources WHERE access_level = 'admin'").fetchone()
        conn.close()
        res = res_client.get(f"/api/resources/{admin_res['id']}", headers=hdr(self._token("admin")))
        assert res.status_code == 200

    def test_category_filter(self):
        res = res_client.get("/api/resources?category=security", headers=hdr(self._token("super_admin")))
        for r in res.json()["resources"]:
            assert r["category"] == "security"

    def test_no_auth_rejected(self):
        res = res_client.get("/api/resources")
        assert res.status_code in [401, 403, 422]

    def test_resource_count_increases_with_role(self):
        user_count = res_client.get("/api/resources", headers=hdr(self._token("user"))).json()["count"]
        admin_count = res_client.get("/api/resources", headers=hdr(self._token("admin"))).json()["count"]
        sa_count = res_client.get("/api/resources", headers=hdr(self._token("super_admin"))).json()["count"]
        assert user_count < admin_count < sa_count


class TestResourceCreation:

    def test_user_can_create_public(self):
        token = create_access_token({"sub": "u1", "role": "user", "user_id": 1})
        res = res_client.post("/api/resources", headers=hdr(token), json={
            "title": "Test", "content": "c", "access_level": "public",
        })
        assert res.status_code == 201

    def test_user_can_create_user_level(self):
        token = create_access_token({"sub": "u1", "role": "user", "user_id": 1})
        res = res_client.post("/api/resources", headers=hdr(token), json={
            "title": "Test", "content": "c", "access_level": "user",
        })
        assert res.status_code == 201

    def test_user_cannot_create_admin(self):
        token = create_access_token({"sub": "u1", "role": "user", "user_id": 1})
        res = res_client.post("/api/resources", headers=hdr(token), json={
            "title": "Test", "content": "c", "access_level": "admin",
        })
        assert res.status_code == 403


# ══════════════════════════════════════════════════════
# E2E TESTS
# ══════════════════════════════════════════════════════

class TestE2EMultiRoleFlow:

    def test_full_user_lifecycle(self):
        """Register → login → access resources → logout."""
        register()
        tokens = login().json()
        token = tokens["access_token"]

        me = auth_client.get("/api/me", headers=hdr(token)).json()
        assert me["role"] == "user"

        resources = res_client.get("/api/resources", headers=hdr(token)).json()
        assert resources["count"] > 0
        for r in resources["resources"]:
            assert r["access_level"] in ["public", "user"]

        auth_client.post("/api/logout", json={"refresh_token": tokens["refresh_token"]})

    def test_role_upgrade_unlocks_resources(self):
        """Register as user → admin upgrades → can now see admin resources."""
        register()
        admin_token = get_admin_token()

        users = auth_client.get("/api/users", headers=hdr(admin_token)).json()
        tu = next(u for u in users if u["username"] == "testuser")

        # Before upgrade: user level
        user_token = login().json()["access_token"]
        before = res_client.get("/api/resources", headers=hdr(user_token)).json()
        before_levels = set(r["access_level"] for r in before["resources"])
        assert "admin" not in before_levels

        # Upgrade
        auth_client.put(f"/api/users/{tu['id']}/role", json={"role": "admin"}, headers=hdr(admin_token))

        # After upgrade: need to re-login to get new token with updated role
        new_token = login().json()["access_token"]
        after = res_client.get("/api/resources", headers=hdr(new_token)).json()
        after_levels = set(r["access_level"] for r in after["resources"])
        assert "admin" in after_levels

    def test_token_refresh_maintains_resource_access(self):
        register()
        tokens = login().json()
        new_tokens = auth_client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]}).json()
        res = res_client.get("/api/resources", headers=hdr(new_tokens["access_token"]))
        assert res.status_code == 200
        assert res.json()["count"] > 0

    def test_cross_server_token_validation(self):
        """Token issued by auth server is valid on resource server."""
        register()
        token = login().json()["access_token"]
        # Same token works on both servers
        assert auth_client.get("/api/me", headers=hdr(token)).status_code == 200
        assert res_client.get("/api/resources", headers=hdr(token)).status_code == 200
