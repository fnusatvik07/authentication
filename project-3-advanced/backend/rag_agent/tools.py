"""Search tools for the Agentic RAG system.

Each tool is gated by role — the agent only receives tools the user is authorized to use.
"""

import os
import json
import sqlite3
import numpy as np
from pathlib import Path

import faiss
import chromadb

VECTOR_DIR = Path(__file__).parent.parent / "vector_db"
FAISS_INDEX_PATH = VECTOR_DIR / "faiss_public.index"
FAISS_DOCS_PATH = VECTOR_DIR / "faiss_public_docs.json"
CHROMA_DIR = VECTOR_DIR / "chroma_data"
AUTH_DB_PATH = Path(__file__).parent.parent / "auth_service" / "auth.db"

# Lazy-loaded resources
_faiss_index = None
_faiss_docs = None
_chroma_client = None


def _get_faiss():
    global _faiss_index, _faiss_docs
    if _faiss_index is None:
        _faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        with open(FAISS_DOCS_PATH) as f:
            _faiss_docs = json.load(f)
    return _faiss_index, _faiss_docs


def _get_chroma():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _chroma_client


def _get_query_embedding(text: str) -> np.ndarray:
    """Get embedding for a query string."""
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            response = client.embeddings.create(input=[text], model="text-embedding-3-small")
            return np.array([response.data[0].embedding], dtype=np.float32)
        except Exception:
            pass
    # Fallback: random embedding (won't give meaningful results but works for demo)
    np.random.seed(hash(text) % 2**32)
    return np.random.rand(1, 1536).astype(np.float32)


# ──────────────────────────────────────────────────────
# Tool: Public Search (FAISS) — available to all roles
# ──────────────────────────────────────────────────────

def public_search(query: str, k: int = 3) -> list[dict]:
    """Search public knowledge base using FAISS vector similarity.

    Available to: guest, user, admin, super_admin
    Source: Public documentation, product info, FAQs
    """
    index, docs = _get_faiss()
    query_vec = _get_query_embedding(query)
    distances, indices = index.search(query_vec, k)

    results = []
    for i, idx in enumerate(indices[0]):
        if idx < len(docs) and idx >= 0:
            doc = docs[idx]
            results.append({
                "content": doc["content"],
                "source": doc["metadata"].get("source", "unknown"),
                "category": doc["metadata"].get("category", "general"),
                "score": float(distances[0][i]),
                "access_level": "public",
                "tool": "public_search",
            })
    return results


# ──────────────────────────────────────────────────────
# Tool: Internal Search (ChromaDB) — user+ access
# ──────────────────────────────────────────────────────

def internal_search(query: str, k: int = 3) -> list[dict]:
    """Search internal documentation using ChromaDB.

    Available to: user, admin, super_admin
    Source: Internal docs, roadmaps, team handbooks
    """
    client = _get_chroma()
    collection = client.get_collection("internal_docs")
    results = collection.query(query_texts=[query], n_results=k)

    output = []
    for i in range(len(results["documents"][0])):
        output.append({
            "content": results["documents"][0][i],
            "source": results["metadatas"][0][i].get("source", "unknown"),
            "category": results["metadatas"][0][i].get("category", "general"),
            "score": float(results["distances"][0][i]) if results["distances"] else 0,
            "access_level": "internal",
            "tool": "internal_search",
        })
    return output


# ──────────────────────────────────────────────────────
# Tool: Admin Search (ChromaDB) — admin+ access
# ──────────────────────────────────────────────────────

def admin_search(query: str, k: int = 3) -> list[dict]:
    """Search admin-level documents including configs, costs, and security policies.

    Available to: admin, super_admin
    Source: Infrastructure costs, security playbooks, compliance docs
    """
    client = _get_chroma()
    collection = client.get_collection("admin_docs")
    results = collection.query(query_texts=[query], n_results=k)

    output = []
    for i in range(len(results["documents"][0])):
        output.append({
            "content": results["documents"][0][i],
            "source": results["metadatas"][0][i].get("source", "unknown"),
            "category": results["metadatas"][0][i].get("category", "general"),
            "score": float(results["distances"][0][i]) if results["distances"] else 0,
            "access_level": "admin",
            "tool": "admin_search",
        })
    return output


# ──────────────────────────────────────────────────────
# Tool: Database Query (SQLite) — super_admin only
# ──────────────────────────────────────────────────────

def database_query(query: str) -> list[dict]:
    """Execute a read-only SQL query on the auth database.

    Available to: super_admin ONLY
    Source: Direct database access (users, audit logs)

    SECURITY: Only SELECT statements are allowed.
    """
    # Validate query is read-only
    normalized = query.strip().upper()
    if not normalized.startswith("SELECT"):
        return [{"error": "Only SELECT queries are allowed", "tool": "database_query"}]

    dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE", "EXEC", "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX"]
    for keyword in dangerous_keywords:
        # Check for keyword as whole word to avoid false positives but catch SQL injection
        if keyword in normalized.split() or f" {keyword} " in f" {normalized} " or normalized.startswith(keyword):
            return [{"error": f"Query contains forbidden keyword: {keyword}", "tool": "database_query"}]

    # Block semicolons to prevent multi-statement injection
    if ";" in query:
        return [{"error": "Multiple statements not allowed", "tool": "database_query"}]

    try:
        conn = sqlite3.connect(str(AUTH_DB_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(query)
        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows[:20]:  # Limit to 20 rows
            results.append({
                "content": str(dict(row)),
                "source": "database",
                "category": "database",
                "access_level": "super_admin",
                "tool": "database_query",
            })
        return results if results else [{"content": "No results found", "tool": "database_query"}]
    except Exception as e:
        return [{"error": str(e), "tool": "database_query"}]


# ──────────────────────────────────────────────────────
# Tool registry
# ──────────────────────────────────────────────────────

TOOL_REGISTRY = {
    "public_search": {
        "function": public_search,
        "description": "Search public knowledge base (product info, FAQs, docs)",
        "min_role": "guest",
    },
    "internal_search": {
        "function": internal_search,
        "description": "Search internal docs (roadmaps, handbooks, team info)",
        "min_role": "user",
    },
    "admin_search": {
        "function": admin_search,
        "description": "Search admin docs (costs, security, compliance)",
        "min_role": "admin",
    },
    "database_query": {
        "function": database_query,
        "description": "Execute read-only SQL on auth database",
        "min_role": "super_admin",
    },
}
