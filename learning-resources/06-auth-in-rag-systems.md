# Authentication in RAG (Retrieval-Augmented Generation) Systems

## Why Auth Matters in RAG

RAG systems retrieve documents from knowledge bases and use them to generate responses. Without proper authentication and authorization:
- Users could access confidential documents through generated answers
- The LLM might leak sensitive data from documents the user shouldn't see
- There's no audit trail of who accessed what information

**The fundamental challenge:** The LLM doesn't know about access control — your application must enforce it at the retrieval layer.

## Architecture: Auth-Aware RAG

```
                          ┌─────────────────────┐
                          │    Auth Service      │
                          │  (JWT + RBAC)        │
                          └──────────┬──────────┘
                                     │ verify token
                                     │ extract role
                                     ▼
┌────────┐    query    ┌─────────────────────────┐
│  User  │────────────>│      RAG Agent          │
│        │             │                         │
│ role:  │             │  1. Determine tools     │
│ "user" │             │     based on role       │
│        │             │                         │
│        │             │  2. Route to permitted  │
│        │             │     search tools        │
└────────┘             │                         │
                       │  3. Generate response   │
                       │     from retrieved docs │
                       └────────┬────────────────┘
                                │
            ┌───────────┬───────┼───────────┐
            ▼           ▼       ▼           ▼
      ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐
      │ Public   │ │Internal│ │ Admin  │ │  SQL   │
      │ Search   │ │ Search │ │ Search │ │ Query  │
      │ (FAISS)  │ │(Chroma)│ │(Chroma)│ │(SQLite)│
      │          │ │        │ │        │ │        │
      │ guest+   │ │ user+  │ │ admin+ │ │ super  │
      │          │ │        │ │        │ │ admin  │
      └──────────┘ └────────┘ └────────┘ └────────┘
```

## Three Approaches to Auth in RAG

### 1. Pre-Retrieval Filtering (Recommended)
Filter which collections/indexes the user can search **before** retrieval.

```python
def search(query: str, user_role: str):
    available_tools = get_tools_for_role(user_role)
    results = []
    for tool in available_tools:
        results.extend(tool.search(query))
    return results
```

**Pros:** No leakage possible, clean separation
**Cons:** May miss relevant cross-level results

### 2. Metadata Filtering
All documents are in one index, filtered by metadata during retrieval.

```python
# Documents stored with access_level metadata
doc = {
    "content": "Q3 revenue was $50M...",
    "metadata": {"access_level": "admin", "department": "finance"}
}

# Query filters by user's access level
results = collection.query(
    query_texts=[user_query],
    where={"access_level": {"$in": allowed_levels_for_role(user_role)}}
)
```

**Pros:** Single index, flexible
**Cons:** Relies on metadata being correct, harder to audit

### 3. Post-Retrieval Filtering
Retrieve all results, then filter based on permissions before passing to LLM.

```python
results = vector_db.similarity_search(query, k=20)
filtered = [r for r in results if user_can_access(user_role, r.metadata)]
context = filtered[:5]  # Top 5 permitted results
```

**Pros:** Best relevance ranking
**Cons:** Wasteful, potential timing-based information leakage

## Document Ingestion with Access Levels

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
import chromadb

client = chromadb.Client()

# Create separate collections per access level
public_collection = client.create_collection("public_docs")
internal_collection = client.create_collection("internal_docs")
admin_collection = client.create_collection("admin_docs")

def ingest_document(content: str, access_level: str, metadata: dict):
    """Ingest document into the appropriate collection."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text(content)

    collection_map = {
        "public": public_collection,
        "internal": internal_collection,
        "admin": admin_collection,
    }

    collection = collection_map[access_level]
    collection.add(
        documents=chunks,
        metadatas=[{**metadata, "access_level": access_level}] * len(chunks),
        ids=[f"{metadata['doc_id']}_chunk_{i}" for i in range(len(chunks))]
    )
```

## Agentic RAG with Auth-Gated Tools

The most powerful pattern: each search capability is a **tool** that the agent can invoke, and tools are gated by user role.

```python
from langchain.tools import tool

@tool
def public_knowledge_search(query: str) -> str:
    """Search public knowledge base. Available to all users."""
    results = faiss_index.similarity_search(query, k=3)
    return "\n".join([r.page_content for r in results])

@tool
def internal_docs_search(query: str) -> str:
    """Search internal documentation. Requires 'user' role or higher."""
    results = chroma_internal.query(query_texts=[query], n_results=3)
    return "\n".join(results["documents"][0])

@tool
def admin_config_search(query: str) -> str:
    """Search admin configurations and policies. Requires 'admin' role."""
    results = chroma_admin.query(query_texts=[query], n_results=3)
    return "\n".join(results["documents"][0])

@tool
def database_query(query: str) -> str:
    """Execute read-only SQL queries. Requires 'super_admin' role."""
    # Sanitize and execute query
    conn = sqlite3.connect("data.db")
    results = conn.execute(query).fetchall()
    conn.close()
    return str(results)

# Agent gets only the tools matching the user's role
TOOL_ROLE_MAP = {
    "public_knowledge_search": "guest",
    "internal_docs_search": "user",
    "admin_config_search": "admin",
    "database_query": "super_admin",
}

def get_agent_for_user(user_role: str):
    """Create an agent with tools appropriate for the user's role."""
    role_level = ROLE_HIERARCHY[user_role]
    available_tools = [
        tool for tool_name, required_role in TOOL_ROLE_MAP.items()
        if ROLE_HIERARCHY[required_role] <= role_level
        for tool in ALL_TOOLS if tool.name == tool_name
    ]
    return create_agent(tools=available_tools)
```

## Vector Database Choice for Auth

| Database | Auth Support | Collection Isolation | Best For |
|----------|-------------|---------------------|----------|
| **FAISS** | None (app-level) | Separate indexes | Fast local search, public data |
| **ChromaDB** | None (app-level) | Collections | Prototyping, metadata filtering |
| **Pinecone** | Namespaces | Namespaces | Production, multi-tenant |
| **Weaviate** | Built-in RBAC | Multi-tenancy | Enterprise, complex auth |
| **Qdrant** | API keys + collections | Collections | Production, flexible |

For learning: **FAISS** for public/fast search + **ChromaDB** for role-gated collections.

## Security Checklist for RAG Auth

- [ ] Authenticate user before any retrieval
- [ ] Extract role from verified JWT (not from request body)
- [ ] Filter tools/collections based on role at the application layer
- [ ] Never pass unfiltered retrieval results to the LLM
- [ ] Sanitize SQL queries if using database tools
- [ ] Log all queries with user identity and accessed collections
- [ ] Rate limit RAG queries per user/role
- [ ] Validate document access levels during ingestion
- [ ] Test with role escalation attempts (user trying admin tools)
- [ ] Ensure LLM system prompt doesn't override access controls
