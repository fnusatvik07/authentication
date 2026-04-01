"""Comprehensive tests for Project 1: Basic JWT Authentication.

Tests cover:
- Unit tests: password hashing, JWT creation/verification
- Integration tests: API endpoints (register, login, protected routes)
- E2E tests: full user flow from registration to accessing protected data
- Edge cases: duplicate users, wrong passwords, expired tokens, malformed tokens
"""

import os
import sys
import time
import sqlite3
import pytest
from datetime import timedelta, datetime, timezone
from pathlib import Path

# Ensure we can import project modules
sys.path.insert(0, str(Path(__file__).parent))

from fastapi.testclient import TestClient
import jwt

# Override DB path before importing app modules
import database
database.DB_PATH = Path(__file__).parent / "test_users.db"

from main import app
from auth import (
    hash_password, verify_password, create_access_token,
    decode_token, SECRET_KEY, ALGORITHM,
)

client = TestClient(app)


# ──────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_db():
    """Reset database before each test."""
    db_path = database.DB_PATH
    if db_path.exists():
        db_path.unlink()
    database.init_db()
    yield
    if db_path.exists():
        db_path.unlink()


def register_user(username="testuser", email="test@example.com", password="TestPass123"):
    return client.post("/api/register", json={
        "username": username, "email": email, "password": password,
    })


def login_user(username="testuser", password="TestPass123"):
    return client.post("/api/login", json={
        "username": username, "password": password,
    })


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════
# UNIT TESTS
# ══════════════════════════════════════════════════════

class TestPasswordHashing:
    """Unit tests for password hashing utilities."""

    def test_hash_password_returns_bcrypt_hash(self):
        hashed = hash_password("mypassword")
        assert hashed.startswith("$2b$")
        assert len(hashed) == 60

    def test_hash_password_different_each_time(self):
        """Each call generates a unique salt, so hashes differ."""
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2

    def test_verify_password_correct(self):
        hashed = hash_password("mypassword")
        assert verify_password("mypassword", hashed) is True

    def test_verify_password_wrong(self):
        hashed = hash_password("mypassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_verify_password_empty(self):
        hashed = hash_password("mypassword")
        assert verify_password("", hashed) is False

    def test_hash_password_special_characters(self):
        special = "p@$$w0rd!#%^&*()"
        hashed = hash_password(special)
        assert verify_password(special, hashed) is True

    def test_hash_password_unicode(self):
        unicode_pw = "пароль密码パスワード"
        hashed = hash_password(unicode_pw)
        assert verify_password(unicode_pw, hashed) is True


class TestJWTTokens:
    """Unit tests for JWT token creation and verification."""

    def test_create_access_token(self):
        token = create_access_token({"sub": "testuser"})
        assert isinstance(token, str)
        parts = token.split(".")
        assert len(parts) == 3  # header.payload.signature

    def test_decode_valid_token(self):
        token = create_access_token({"sub": "testuser"})
        payload = decode_token(token)
        assert payload["sub"] == "testuser"
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_expired_token(self):
        token = create_access_token(
            {"sub": "testuser"},
            expires_delta=timedelta(seconds=-1),
        )
        with pytest.raises(Exception):  # HTTPException
            decode_token(token)

    def test_decode_invalid_token(self):
        with pytest.raises(Exception):
            decode_token("not.a.valid.token")

    def test_decode_tampered_token(self):
        token = create_access_token({"sub": "testuser"})
        # Tamper with the payload
        parts = token.split(".")
        parts[1] = parts[1] + "tampered"
        tampered = ".".join(parts)
        with pytest.raises(Exception):
            decode_token(tampered)

    def test_token_contains_correct_claims(self):
        token = create_access_token({"sub": "alice", "custom": "value"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "alice"
        assert payload["custom"] == "value"

    def test_custom_expiry(self):
        token = create_access_token(
            {"sub": "testuser"},
            expires_delta=timedelta(hours=2),
        )
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = (exp - now).total_seconds()
        assert 7100 < diff < 7300  # ~2 hours


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS
# ══════════════════════════════════════════════════════

class TestRegisterEndpoint:
    """Integration tests for POST /api/register."""

    def test_register_success(self):
        res = register_user()
        assert res.status_code == 201
        data = res.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert "id" in data
        assert "password" not in data  # Never return password

    def test_register_duplicate_username(self):
        register_user()
        res = register_user(email="other@example.com")
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"]

    def test_register_duplicate_email(self):
        register_user()
        res = register_user(username="other")
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"]

    def test_register_stores_hashed_password(self):
        register_user()
        conn = database.get_db()
        user = conn.execute("SELECT password_hash FROM users WHERE username = 'testuser'").fetchone()
        conn.close()
        assert user["password_hash"].startswith("$2b$")
        assert user["password_hash"] != "TestPass123"

    def test_register_missing_fields(self):
        res = client.post("/api/register", json={"username": "test"})
        assert res.status_code == 422  # Validation error


class TestLoginEndpoint:
    """Integration tests for POST /api/login."""

    def test_login_success(self):
        register_user()
        res = login_user()
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self):
        register_user()
        res = login_user(password="WrongPass")
        assert res.status_code == 401
        assert "Invalid" in res.json()["detail"]

    def test_login_nonexistent_user(self):
        res = login_user(username="nobody")
        assert res.status_code == 401

    def test_login_returns_valid_jwt(self):
        register_user()
        res = login_user()
        token = res.json()["access_token"]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"

    def test_login_empty_password(self):
        register_user()
        res = login_user(password="")
        assert res.status_code == 401


class TestAccountLockout:
    """Tests for brute-force protection via account lockout."""

    def test_account_locks_after_max_attempts(self):
        register_user()
        for _ in range(5):
            login_user(password="wrong")
        res = login_user(password="TestPass123")
        assert res.status_code == 423
        assert "locked" in res.json()["detail"].lower()

    def test_correct_password_resets_counter(self):
        register_user()
        login_user(password="wrong")
        login_user(password="wrong")
        # Correct login resets the counter
        res = login_user()
        assert res.status_code == 200
        # Now fail again — should start from 0, not 2
        for _ in range(4):
            login_user(password="wrong")
        res = login_user()
        assert res.status_code == 200

    def test_locked_account_rejects_correct_password(self):
        register_user()
        for _ in range(5):
            login_user(password="wrong")
        # Even correct password is rejected while locked
        res = login_user(password="TestPass123")
        assert res.status_code == 423


class TestProtectedEndpoints:
    """Integration tests for JWT-protected endpoints."""

    def test_me_with_valid_token(self):
        register_user()
        token = login_user().json()["access_token"]
        res = client.get("/api/me", headers=auth_header(token))
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    def test_me_without_token(self):
        res = client.get("/api/me")
        assert res.status_code == 401

    def test_me_with_invalid_token(self):
        res = client.get("/api/me", headers=auth_header("invalid.token.here"))
        assert res.status_code == 401

    def test_protected_with_valid_token(self):
        register_user()
        token = login_user().json()["access_token"]
        res = client.get("/api/protected", headers=auth_header(token))
        assert res.status_code == 200
        assert "testuser" in res.json()["message"]

    def test_protected_without_token(self):
        res = client.get("/api/protected")
        assert res.status_code == 401

    def test_protected_with_expired_token(self):
        token = create_access_token({"sub": "testuser"}, expires_delta=timedelta(seconds=-1))
        res = client.get("/api/protected", headers=auth_header(token))
        assert res.status_code == 401


class TestHealthEndpoint:
    """Integration tests for health check."""

    def test_health_no_auth_required(self):
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"


# ══════════════════════════════════════════════════════
# E2E TESTS
# ══════════════════════════════════════════════════════

class TestE2EUserFlow:
    """End-to-end tests simulating real user workflows."""

    def test_full_register_login_access_flow(self):
        """Complete flow: register → login → access protected → verify profile."""
        # Step 1: Register
        reg_res = register_user()
        assert reg_res.status_code == 201
        user_id = reg_res.json()["id"]

        # Step 2: Login
        login_res = login_user()
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        # Step 3: Access protected route
        prot_res = client.get("/api/protected", headers=auth_header(token))
        assert prot_res.status_code == 200
        assert prot_res.json()["user_id"] == user_id

        # Step 4: Get profile
        me_res = client.get("/api/me", headers=auth_header(token))
        assert me_res.status_code == 200
        assert me_res.json()["id"] == user_id

    def test_multiple_users_isolation(self):
        """Different users get different tokens and profiles."""
        register_user("alice", "alice@test.com", "AlicePass1")
        register_user("bob", "bob@test.com", "BobPass1")

        alice_token = login_user("alice", "AlicePass1").json()["access_token"]
        bob_token = login_user("bob", "BobPass1").json()["access_token"]

        alice_me = client.get("/api/me", headers=auth_header(alice_token)).json()
        bob_me = client.get("/api/me", headers=auth_header(bob_token)).json()

        assert alice_me["username"] == "alice"
        assert bob_me["username"] == "bob"
        assert alice_me["id"] != bob_me["id"]

    def test_cannot_use_another_users_token_for_wrong_profile(self):
        """Token is bound to the user who logged in."""
        register_user("alice", "alice@test.com", "AlicePass1")
        register_user("bob", "bob@test.com", "BobPass1")

        alice_token = login_user("alice", "AlicePass1").json()["access_token"]

        # Alice's token returns Alice's profile (not Bob's)
        me = client.get("/api/me", headers=auth_header(alice_token)).json()
        assert me["username"] == "alice"

    def test_login_after_failed_attempts(self):
        """Successful login works after failed attempts."""
        register_user()
        login_user(password="wrong1")
        login_user(password="wrong2")
        res = login_user(password="TestPass123")
        assert res.status_code == 200
        assert "access_token" in res.json()


# ══════════════════════════════════════════════════════
# EDGE CASE TESTS
# ══════════════════════════════════════════════════════

class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_token_with_wrong_secret(self):
        """Token signed with different secret is rejected."""
        token = jwt.encode({"sub": "testuser", "exp": datetime.now(timezone.utc) + timedelta(hours=1)}, "wrong-secret", algorithm=ALGORITHM)
        res = client.get("/api/me", headers=auth_header(token))
        assert res.status_code == 401

    def test_token_without_sub_claim(self):
        """Token missing 'sub' claim is rejected."""
        token = create_access_token({"not_sub": "testuser"})
        res = client.get("/api/me", headers=auth_header(token))
        assert res.status_code == 401

    def test_token_for_deleted_user(self):
        """Token for a user that no longer exists."""
        register_user()
        token = login_user().json()["access_token"]
        # Delete user from DB
        conn = database.get_db()
        conn.execute("DELETE FROM users WHERE username = 'testuser'")
        conn.commit()
        conn.close()

        res = client.get("/api/me", headers=auth_header(token))
        assert res.status_code == 404

    def test_empty_auth_header(self):
        res = client.get("/api/me", headers={"Authorization": ""})
        assert res.status_code in [401, 403]

    def test_bearer_prefix_missing(self):
        register_user()
        token = login_user().json()["access_token"]
        res = client.get("/api/me", headers={"Authorization": token})
        assert res.status_code in [401, 403]

    def test_register_long_username(self):
        res = register_user(username="a" * 500, email="long@test.com")
        # Should still work (no length limit enforced)
        assert res.status_code == 201

    def test_register_special_chars_in_password(self):
        res = register_user(password="!@#$%^&*()_+-=[]{}|;':\",./<>?")
        assert res.status_code == 201
        login_res = login_user(password="!@#$%^&*()_+-=[]{}|;':\",./<>?")
        assert login_res.status_code == 200
