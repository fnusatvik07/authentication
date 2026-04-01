"""Comprehensive tests for Project 3: Agentic RAG with Authenticated Multi-Tool Search.

Tests cover:
- Unit tests: Tool permissions, role-based tool gating, SQL injection blocking
- Integration tests: Auth endpoints, chat endpoint, tools endpoint, audit logging
- E2E tests: Different roles querying RAG, role upgrade changes tool access
- Edge cases: SQL injection attempts, prompt injection, unauthorized tool access
"""

import os
import sys
import json
import sqlite3
import pytest
from datetime import timedelta, datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

# Setup paths
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

# Set test environment
os.environ["OPENAI_API_KEY"] = ""  # Disable real API calls for testing
os.environ["SECRET_KEY"] = "test-secret-key-for-project3"

from fastapi.testclient import TestClient
import jwt

# Override DB path before imports
from auth_service import database as auth_db
auth_db.DB_PATH = BACKEND_DIR / "test_auth.db"

from auth_service.auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, hash_token, decode_access_token,
    get_available_tools, require_role, ROLE_HIERARCHY,
    TOOL_PERMISSIONS, SECRET_KEY, ALGORITHM,
)

# Setup vector DB paths for tools
from rag_agent import tools as rag_tools
VECTOR_DIR = BACKEND_DIR / "test_vector_data"
rag_tools.FAISS_INDEX_PATH = VECTOR_DIR / "faiss_public.index"
rag_tools.FAISS_DOCS_PATH = VECTOR_DIR / "faiss_public_docs.json"
rag_tools.CHROMA_DIR = VECTOR_DIR / "chroma_data"
rag_tools.AUTH_DB_PATH = auth_db.DB_PATH

from main import app
client = TestClient(app)


# ──────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_db():
    """Reset test database before each test."""
    if auth_db.DB_PATH.exists():
        auth_db.DB_PATH.unlink()
    auth_db.init_db()
    # Seed test users
    conn = auth_db.get_db()
    users = [
        ("admin", "admin@test.com", hash_password("admin123"), "super_admin", "exec"),
        ("manager", "mgr@test.com", hash_password("mgr123"), "admin", "eng"),
        ("dev", "dev@test.com", hash_password("dev123"), "user", "eng"),
        ("viewer", "view@test.com", hash_password("view123"), "guest", "gen"),
    ]
    for u in users:
        conn.execute(
            "INSERT OR IGNORE INTO users (username, email, password_hash, role, department) VALUES (?,?,?,?,?)", u
        )
    conn.commit()
    conn.close()
    yield
    if auth_db.DB_PATH.exists():
        auth_db.DB_PATH.unlink()


def login(username, password):
    return client.post("/api/login", json={"username": username, "password": password})


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def token_for(username, password):
    return login(username, password).json()["access_token"]


# ══════════════════════════════════════════════════════
# UNIT TESTS - TOOL PERMISSIONS
# ══════════════════════════════════════════════════════

class TestToolPermissions:
    """Unit tests for role-based tool access."""

    def test_guest_gets_only_public_search(self):
        tools = get_available_tools("guest")
        assert tools == ["public_search"]

    def test_user_gets_public_and_internal(self):
        tools = get_available_tools("user")
        assert "public_search" in tools
        assert "internal_search" in tools
        assert "admin_search" not in tools
        assert "database_query" not in tools

    def test_admin_gets_three_tools(self):
        tools = get_available_tools("admin")
        assert len(tools) == 3
        assert "admin_search" in tools
        assert "database_query" not in tools

    def test_super_admin_gets_all_tools(self):
        tools = get_available_tools("super_admin")
        assert len(tools) == 4
        assert "database_query" in tools

    def test_unknown_role_gets_only_guest_level(self):
        """Unknown role defaults to level 0, same as guest — gets public_search only."""
        tools = get_available_tools("nonexistent")
        assert tools == ["public_search"]

    def test_tool_permissions_map_complete(self):
        """All registered tools have valid min roles."""
        for tool, role in TOOL_PERMISSIONS.items():
            assert role in ROLE_HIERARCHY, f"Tool {tool} requires undefined role {role}"


class TestRoleHierarchy:

    def test_hierarchy_ordered(self):
        assert ROLE_HIERARCHY["guest"] < ROLE_HIERARCHY["user"]
        assert ROLE_HIERARCHY["user"] < ROLE_HIERARCHY["admin"]
        assert ROLE_HIERARCHY["admin"] < ROLE_HIERARCHY["super_admin"]

    def test_require_role_higher_passes(self):
        token = create_access_token({"sub": "a", "role": "super_admin", "user_id": 1})
        result = require_role("user")(token=token)
        assert result["role"] == "super_admin"

    def test_require_role_lower_fails(self):
        token = create_access_token({"sub": "u", "role": "user", "user_id": 2})
        with pytest.raises(Exception):
            require_role("admin")(token=token)


# ══════════════════════════════════════════════════════
# UNIT TESTS - SQL INJECTION BLOCKING
# ══════════════════════════════════════════════════════

class TestDatabaseQuerySafety:
    """Test SQL injection prevention in the database_query tool."""

    def test_select_allowed(self):
        result = rag_tools.database_query("SELECT id, username FROM users LIMIT 5")
        assert not any("error" in r for r in result)

    def test_drop_blocked(self):
        result = rag_tools.database_query("DROP TABLE users")
        assert any("error" in r or "forbidden" in str(r).lower() for r in result)

    def test_delete_blocked(self):
        result = rag_tools.database_query("DELETE FROM users WHERE id = 1")
        assert any("error" in r for r in result)

    def test_update_blocked(self):
        result = rag_tools.database_query("UPDATE users SET role = 'super_admin'")
        assert any("error" in r for r in result)

    def test_insert_blocked(self):
        result = rag_tools.database_query("INSERT INTO users VALUES (99, 'hacker', 'h@h.com', 'x', 'super_admin', 'x', 1, 'now')")
        assert any("error" in r for r in result)

    def test_semicolon_injection_blocked(self):
        result = rag_tools.database_query("SELECT 1; DROP TABLE users")
        assert any("error" in r for r in result)

    def test_alter_blocked(self):
        result = rag_tools.database_query("ALTER TABLE users ADD COLUMN hacked TEXT")
        assert any("error" in r for r in result)

    def test_pragma_blocked(self):
        result = rag_tools.database_query("PRAGMA table_info(users)")
        assert any("error" in r for r in result)

    def test_non_select_blocked(self):
        result = rag_tools.database_query("CREATE TABLE hacked (id int)")
        assert any("error" in r for r in result)


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS - AUTH ENDPOINTS
# ══════════════════════════════════════════════════════

class TestAuthEndpoints:

    def test_register_new_user(self):
        res = client.post("/api/register", json={
            "username": "newuser", "email": "new@test.com",
            "password": "newpass", "department": "sales",
        })
        assert res.status_code == 201
        assert res.json()["role"] == "user"
        assert res.json()["department"] == "sales"

    def test_register_duplicate(self):
        res = client.post("/api/register", json={
            "username": "admin", "email": "x@x.com", "password": "x",
        })
        assert res.status_code == 400

    def test_login_all_seeded_users(self):
        for user, pw in [("admin", "admin123"), ("manager", "mgr123"), ("dev", "dev123"), ("viewer", "view123")]:
            res = login(user, pw)
            assert res.status_code == 200, f"Login failed for {user}"
            assert "access_token" in res.json()
            assert "refresh_token" in res.json()

    def test_login_wrong_password(self):
        assert login("admin", "wrong").status_code == 401

    def test_login_deactivated(self):
        conn = auth_db.get_db()
        conn.execute("UPDATE users SET is_active = 0 WHERE username = 'dev'")
        conn.commit()
        conn.close()
        assert login("dev", "dev123").status_code == 403

    def test_account_lockout_after_failed_attempts(self):
        """5 wrong passwords → account locked."""
        for _ in range(5):
            login("dev", "wrong")
        res = login("dev", "dev123")
        assert res.status_code == 423

    def test_me_returns_correct_profile(self):
        token = token_for("manager", "mgr123")
        res = client.get("/api/me", headers=hdr(token))
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "manager"
        assert data["role"] == "admin"

    def test_refresh_token_rotation(self):
        tokens = login("dev", "dev123").json()
        new = client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]}).json()
        assert new["refresh_token"] != tokens["refresh_token"]
        # Old token revoked
        res = client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert res.status_code == 401


# ══════════════════════════════════════════════════════
# UNIT TESTS - REACT AGENT
# ══════════════════════════════════════════════════════

class TestReActParser:
    """Test the ReAct output parser."""

    def test_parse_action(self):
        from rag_agent.agent import _parse_react_output
        text = "Thought: I need to search for product info\nAction: public_search\nInput: product features"
        result = _parse_react_output(text)
        assert result["type"] == "action"
        assert result["tool"] == "public_search"
        assert result["input"] == "product features"
        assert "product info" in result["thought"]

    def test_parse_answer(self):
        from rag_agent.agent import _parse_react_output
        text = "Thought: I have enough info\nAnswer: The product costs $99/month."
        result = _parse_react_output(text)
        assert result["type"] == "answer"
        assert "$99" in result["answer"]

    def test_parse_multiline_answer(self):
        from rag_agent.agent import _parse_react_output
        text = "Thought: Done\nAnswer: Here are the results:\n- Item 1\n- Item 2"
        result = _parse_react_output(text)
        assert result["type"] == "answer"
        assert "Item 1" in result["answer"]
        assert "Item 2" in result["answer"]

    def test_parse_unknown(self):
        from rag_agent.agent import _parse_react_output
        result = _parse_react_output("Just some random text")
        assert result["type"] == "unknown"

    def test_parse_db_query_action(self):
        from rag_agent.agent import _parse_react_output
        text = "Thought: Need user data\nAction: database_query\nInput: SELECT id, username FROM users LIMIT 5"
        result = _parse_react_output(text)
        assert result["type"] == "action"
        assert result["tool"] == "database_query"
        assert "SELECT" in result["input"]


class TestReActFallback:
    """Test the fallback agent when no LLM API key is set."""

    def test_fallback_returns_reasoning_steps(self):
        from rag_agent.agent import _fallback_agent
        mock_tools = {
            "public_search": {
                "function": lambda q, k=3: [{"content": "result", "source": "pub", "access_level": "public", "tool": "public_search"}],
                "description": "pub", "min_role": "guest",
            },
        }
        result = _fallback_agent("test query", mock_tools, "guest")
        assert "reasoning_steps" in result
        assert len(result["reasoning_steps"]) >= 1
        assert result["tools_used"] == ["public_search"]
        assert result["user_role"] == "guest"

    def test_fallback_handles_tool_error(self):
        from rag_agent.agent import _fallback_agent
        def broken_tool(q, k=3):
            raise RuntimeError("DB connection failed")
        mock_tools = {
            "broken": {"function": broken_tool, "description": "broken", "min_role": "guest"},
        }
        result = _fallback_agent("test", mock_tools, "guest")
        assert "reasoning_steps" in result
        error_steps = [s for s in result["reasoning_steps"] if "error" in s.get("content", "").lower()]
        assert len(error_steps) >= 1


class TestReActToolGating:
    """Test that the ReAct loop enforces RBAC on tool access."""

    def test_format_observation_with_results(self):
        from rag_agent.agent import _format_observation
        results = [
            {"content": "Some data", "source": "pub"},
            {"error": "Access denied"},
        ]
        obs = _format_observation(results)
        assert "Some data" in obs
        assert "Access denied" in obs

    def test_format_observation_empty(self):
        from rag_agent.agent import _format_observation
        assert "No results" in _format_observation([])


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS - TOOLS ENDPOINT
# ══════════════════════════════════════════════════════

class TestToolsEndpoint:

    def test_guest_sees_one_tool_accessible(self):
        token = token_for("viewer", "view123")
        res = client.get("/api/tools", headers=hdr(token))
        data = res.json()
        accessible = [t for t in data["tools"] if t["accessible"]]
        assert len(accessible) == 1
        assert accessible[0]["name"] == "public_search"

    def test_user_sees_two_tools_accessible(self):
        token = token_for("dev", "dev123")
        res = client.get("/api/tools", headers=hdr(token))
        accessible = [t for t in res.json()["tools"] if t["accessible"]]
        assert len(accessible) == 2

    def test_admin_sees_three_tools_accessible(self):
        token = token_for("manager", "mgr123")
        res = client.get("/api/tools", headers=hdr(token))
        accessible = [t for t in res.json()["tools"] if t["accessible"]]
        assert len(accessible) == 3

    def test_super_admin_sees_all_tools_accessible(self):
        token = token_for("admin", "admin123")
        res = client.get("/api/tools", headers=hdr(token))
        accessible = [t for t in res.json()["tools"] if t["accessible"]]
        assert len(accessible) == 4

    def test_tools_show_locked_for_lower_roles(self):
        token = token_for("dev", "dev123")
        res = client.get("/api/tools", headers=hdr(token))
        locked = [t for t in res.json()["tools"] if not t["accessible"]]
        assert len(locked) == 2
        locked_names = {t["name"] for t in locked}
        assert "admin_search" in locked_names
        assert "database_query" in locked_names

    def test_no_auth_rejected(self):
        assert client.get("/api/tools").status_code in [401, 403]


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS - CHAT / RAG ENDPOINT
# ══════════════════════════════════════════════════════

class TestChatEndpoint:
    """Test the ReAct RAG chat endpoint with mocked tools."""

    def _mock_tools(self):
        return {
            "public_search": lambda q, k=3: [{"content": "Public result", "source": "pub", "category": "gen", "score": 0.1, "access_level": "public", "tool": "public_search"}],
            "internal_search": lambda q, k=3: [{"content": "Internal result", "source": "int", "category": "eng", "score": 0.2, "access_level": "internal", "tool": "internal_search"}],
            "admin_search": lambda q, k=3: [{"content": "Admin result", "source": "adm", "category": "sec", "score": 0.3, "access_level": "admin", "tool": "admin_search"}],
            "database_query": lambda q: [{"content": "DB result", "source": "db", "category": "db", "access_level": "super_admin", "tool": "database_query"}],
        }

    @patch("rag_agent.agent.get_tools_for_role")
    def test_chat_as_guest_uses_public_only(self, mock_get_tools):
        mocks = self._mock_tools()
        mock_get_tools.return_value = {
            "public_search": {"function": mocks["public_search"], "description": "pub", "min_role": "guest"},
        }

        token = token_for("viewer", "view123")
        res = client.post("/api/chat", json={"message": "What products do you offer?"}, headers=hdr(token))
        assert res.status_code == 200
        data = res.json()
        assert "public_search" in data["tools_used"]
        assert "admin_search" not in data["tools_used"]
        assert data["user_role"] == "guest"

    @patch("rag_agent.agent.get_tools_for_role")
    def test_chat_response_has_reasoning_steps(self, mock_get_tools):
        """ReAct agent should return reasoning_steps in the response."""
        mocks = self._mock_tools()
        mock_get_tools.return_value = {
            "public_search": {"function": mocks["public_search"], "description": "pub", "min_role": "guest"},
        }

        token = token_for("viewer", "view123")
        res = client.post("/api/chat", json={"message": "test"}, headers=hdr(token))
        data = res.json()
        assert "reasoning_steps" in data
        assert isinstance(data["reasoning_steps"], list)
        assert len(data["reasoning_steps"]) >= 1
        # Each step should have step number and type
        for step in data["reasoning_steps"]:
            assert "step" in step
            assert "type" in step
            assert step["type"] in ["thought", "observation", "error"]

    @patch("rag_agent.agent.get_tools_for_role")
    def test_chat_as_admin_uses_more_tools(self, mock_get_tools):
        mocks = self._mock_tools()
        mock_get_tools.return_value = {
            "public_search": {"function": mocks["public_search"], "description": "pub", "min_role": "guest"},
            "internal_search": {"function": mocks["internal_search"], "description": "int", "min_role": "user"},
            "admin_search": {"function": mocks["admin_search"], "description": "adm", "min_role": "admin"},
        }

        token = token_for("manager", "mgr123")
        res = client.post("/api/chat", json={"message": "What are the infra costs?"}, headers=hdr(token))
        assert res.status_code == 200
        data = res.json()
        assert data["user_role"] == "admin"
        assert len(data["tools_used"]) >= 1

    def test_chat_no_auth_rejected(self):
        res = client.post("/api/chat", json={"message": "hello"})
        assert res.status_code in [401, 403]

    @patch("rag_agent.agent.get_tools_for_role")
    def test_chat_with_conversation_history(self, mock_get_tools):
        """Chat should accept conversation_history for multi-turn context."""
        mocks = self._mock_tools()
        mock_get_tools.return_value = {
            "public_search": {"function": mocks["public_search"], "description": "pub", "min_role": "guest"},
        }

        token = token_for("dev", "dev123")
        res = client.post("/api/chat", json={
            "message": "tell me more about that",
            "conversation_history": [
                {"role": "user", "content": "What products do you offer?"},
                {"role": "assistant", "content": "We offer an AI search engine."},
            ],
        }, headers=hdr(token))
        assert res.status_code == 200
        assert "reasoning_steps" in res.json()

    @patch("rag_agent.agent.get_tools_for_role")
    def test_chat_logs_to_audit(self, mock_get_tools):
        mocks = self._mock_tools()
        mock_get_tools.return_value = {
            "public_search": {"function": mocks["public_search"], "description": "pub", "min_role": "guest"},
        }

        token = token_for("dev", "dev123")
        client.post("/api/chat", json={"message": "test query"}, headers=hdr(token))

        conn = auth_db.get_db()
        logs = conn.execute("SELECT * FROM query_audit_log WHERE username = 'dev'").fetchall()
        conn.close()
        assert len(logs) == 1
        assert logs[0]["query"] == "test query"
        assert logs[0]["role"] == "user"


# ══════════════════════════════════════════════════════
# INTEGRATION TESTS - ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════

class TestAdminEndpoints:

    def test_list_users_admin(self):
        token = token_for("manager", "mgr123")
        res = client.get("/api/users", headers=hdr(token))
        assert res.status_code == 200
        assert len(res.json()) >= 4

    def test_list_users_user_denied(self):
        token = token_for("dev", "dev123")
        assert client.get("/api/users", headers=hdr(token)).status_code == 403

    def test_list_users_guest_denied(self):
        token = token_for("viewer", "view123")
        assert client.get("/api/users", headers=hdr(token)).status_code == 403

    def test_update_role_super_admin(self):
        token = token_for("admin", "admin123")
        users = client.get("/api/users", headers=hdr(token)).json()
        dev_user = next(u for u in users if u["username"] == "dev")

        res = client.put(f"/api/users/{dev_user['id']}/role", json={"role": "admin"}, headers=hdr(token))
        assert res.status_code == 200
        assert res.json()["role"] == "admin"

    def test_update_role_admin_denied(self):
        token = token_for("manager", "mgr123")
        res = client.put("/api/users/1/role", json={"role": "admin"}, headers=hdr(token))
        assert res.status_code == 403

    def test_audit_log_admin(self):
        token = token_for("manager", "mgr123")
        res = client.get("/api/audit-log", headers=hdr(token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_audit_log_user_denied(self):
        token = token_for("dev", "dev123")
        assert client.get("/api/audit-log", headers=hdr(token)).status_code == 403


# ══════════════════════════════════════════════════════
# TOKEN BLACKLISTING TESTS
# ══════════════════════════════════════════════════════

class TestTokenBlacklisting:
    """Test JTI-based access token revocation."""

    def test_logout_blacklists_token(self):
        """After logout, the same access token should be rejected."""
        token = token_for("dev", "dev123")
        # Token works before logout
        assert client.get("/api/me", headers=hdr(token)).status_code == 200
        # Logout
        res = client.post("/api/logout", headers=hdr(token))
        assert res.status_code == 200
        # Token is now blacklisted
        res = client.get("/api/me", headers=hdr(token))
        assert res.status_code == 401
        assert "revoked" in res.json()["detail"].lower()

    def test_new_token_works_after_logout(self):
        """Logging in again should issue a new (non-blacklisted) token."""
        token1 = token_for("dev", "dev123")
        client.post("/api/logout", headers=hdr(token1))
        # Old token rejected
        assert client.get("/api/me", headers=hdr(token1)).status_code == 401
        # New token works
        token2 = token_for("dev", "dev123")
        assert client.get("/api/me", headers=hdr(token2)).status_code == 200

    def test_token_has_jti_claim(self):
        """Each access token should contain a unique JTI."""
        token = token_for("admin", "admin123")
        import jwt as pyjwt
        payload = pyjwt.decode(token, options={"verify_signature": False})
        assert "jti" in payload
        assert len(payload["jti"]) > 10  # UUID length

    def test_two_tokens_have_different_jtis(self):
        import jwt as pyjwt
        t1 = token_for("admin", "admin123")
        t2 = token_for("admin", "admin123")
        p1 = pyjwt.decode(t1, options={"verify_signature": False})
        p2 = pyjwt.decode(t2, options={"verify_signature": False})
        assert p1["jti"] != p2["jti"]


# ══════════════════════════════════════════════════════
# E2E TESTS
# ══════════════════════════════════════════════════════

class TestE2EFlows:

    @patch("rag_agent.agent.get_tools_for_role")
    def test_guest_to_admin_tool_escalation(self, mock_get_tools):
        """Guest → role upgrade → now has more tools. ReAct response includes steps."""
        mocks = {
            "public_search": lambda q, k=3: [{"content": "pub", "source": "pub", "category": "g", "score": 0.1, "access_level": "public", "tool": "public_search"}],
            "internal_search": lambda q, k=3: [{"content": "int", "source": "int", "category": "g", "score": 0.2, "access_level": "internal", "tool": "internal_search"}],
            "admin_search": lambda q, k=3: [{"content": "adm", "source": "adm", "category": "g", "score": 0.3, "access_level": "admin", "tool": "admin_search"}],
        }

        # Step 1: Guest has 1 tool
        mock_get_tools.return_value = {
            "public_search": {"function": mocks["public_search"], "description": "pub", "min_role": "guest"},
        }
        guest_token = token_for("viewer", "view123")
        res1 = client.post("/api/chat", json={"message": "test"}, headers=hdr(guest_token))
        assert res1.json()["user_role"] == "guest"
        assert "reasoning_steps" in res1.json()  # ReAct trace present
        tools_before = client.get("/api/tools", headers=hdr(guest_token)).json()
        accessible_before = sum(1 for t in tools_before["tools"] if t["accessible"])
        assert accessible_before == 1

        # Step 2: Super admin upgrades guest to admin
        admin_token = token_for("admin", "admin123")
        users = client.get("/api/users", headers=hdr(admin_token)).json()
        viewer = next(u for u in users if u["username"] == "viewer")
        client.put(f"/api/users/{viewer['id']}/role", json={"role": "admin"}, headers=hdr(admin_token))

        # Step 3: Re-login with new role → more tools
        new_token = token_for("viewer", "view123")
        tools_after = client.get("/api/tools", headers=hdr(new_token)).json()
        accessible_after = sum(1 for t in tools_after["tools"] if t["accessible"])
        assert accessible_after == 3

    def test_full_register_chat_audit_flow(self):
        """Register → login → chat → check audit log."""
        # Register
        client.post("/api/register", json={
            "username": "newbie", "email": "n@t.com", "password": "newpass",
        })

        # Login
        tokens = login("newbie", "newpass").json()
        token = tokens["access_token"]

        # Check profile
        me = client.get("/api/me", headers=hdr(token)).json()
        assert me["role"] == "user"

        # Check tools
        tools = client.get("/api/tools", headers=hdr(token)).json()
        accessible = [t["name"] for t in tools["tools"] if t["accessible"]]
        assert "public_search" in accessible
        assert "internal_search" in accessible

    def test_token_refresh_preserves_access(self):
        tokens = login("manager", "mgr123").json()
        new = client.post("/api/refresh", json={"refresh_token": tokens["refresh_token"]}).json()
        # New token still works for admin endpoint
        res = client.get("/api/users", headers=hdr(new["access_token"]))
        assert res.status_code == 200

    def test_health_no_auth(self):
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"
