# Project 3: Agentic RAG with Authenticated Multi-Tool Search

## Overview
An advanced **ReAct agent** (Reason + Act loop) with JWT authentication, RBAC-gated search tools, token blacklisting, account lockout, and conversation memory. The agent thinks step-by-step, choosing which tools to call based on the query and the user's role.

## What You'll Learn
- **ReAct pattern** — Think → Act → Observe loop (not just tool dispatch)
- FAISS for fast vector similarity search (public docs)
- ChromaDB for role-gated document collections
- JWT with **JTI-based token blacklisting** (instant revocation)
- RBAC controlling which tools the agent can invoke per user
- Account lockout after failed login attempts
- Query audit logging with step count
- Conversation memory (multi-turn context)
- Natural language to SQL (super_admin only)

## ReAct Agent Loop
```
User: "What's our AWS spend?"
  │
  ▼
Step 1: THOUGHT — "I need to find infrastructure cost data.
                   The user is an admin, so I can use admin_search."
  │
  ▼
Step 2: ACTION  — admin_search("AWS infrastructure costs")
  │
  ▼
Step 3: OBSERVE — [infra_costs]: AWS: EC2 $25k/mo, S3 $8k/mo...
  │
  ▼
Step 4: THOUGHT — "I found the AWS costs. Let me also check
                   public docs for any published pricing."
  │
  ▼
Step 5: ACTION  — public_search("AWS cloud costs")
  │
  ▼
Step 6: OBSERVE — [pricing]: Enterprise pricing is custom...
  │
  ▼
Step 7: THOUGHT — "I have enough info from both sources."
  │
  ▼
ANSWER: "Based on internal records, total AWS spend is $50k/month..."
```

Each step is visible in the frontend's expandable "ReAct trace".

## Architecture
```
                    ┌──────────────────────────┐
                    │  Auth + Token Blacklist   │
                    │  JWT + RBAC + JTI check   │
                    └──────────┬───────────────┘
                               │
Frontend ──→ POST /api/chat ──→ ReAct Agent (Think→Act→Observe loop)
                                  │
                    ┌─────────────┼──────────────┐─────────────┐
                    ▼             ▼              ▼             ▼
              ┌──────────┐ ┌──────────┐  ┌──────────┐ ┌──────────┐
              │  Public   │ │ Internal │  │  Admin   │ │ Database │
              │  Search   │ │  Search  │  │  Search  │ │  Query   │
              │  (FAISS)  │ │ (Chroma) │  │ (Chroma) │ │ (SQLite) │
              │  guest+   │ │  user+   │  │ admin+   │ │ s_admin  │
              └──────────┘ └──────────┘  └──────────┘ └──────────┘
```

## Security Features

| Feature | How It Works |
|---------|-------------|
| **Token blacklisting** | Each JWT has a unique `jti` (JWT ID). On logout, the `jti` is added to a blacklist. Every request checks the blacklist before granting access. |
| **Account lockout** | 5 failed login attempts → 15 min lockout |
| **RBAC tool gating** | Agent's available tools are filtered by JWT role BEFORE the ReAct loop starts |
| **SQL injection protection** | Keyword blacklist + semicolon blocking on database_query tool |
| **Audit logging** | Every query logged with username, role, tools used, and step count |

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Register new user |
| POST | `/api/login` | No | Login (with lockout) |
| POST | `/api/refresh` | No | Refresh tokens |
| POST | `/api/logout` | JWT | **Blacklist** current access token |
| GET | `/api/me` | JWT | Current user profile |
| POST | `/api/chat` | JWT | ReAct agent query (with conversation history) |
| GET | `/api/tools` | JWT | List tools for your role |
| GET | `/api/users` | admin+ | List all users |
| PUT | `/api/users/:id/role` | super_admin | Change user role |
| GET | `/api/audit-log` | admin+ | Query audit trail |

## Setup
```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt

# Set up vector databases (run once)
python -m vector_db.setup_vectordb

# Start the server
python main.py  # port 8000
```

Make sure `.env` has `OPENAI_API_KEY` set.

## Tests (62 passing)
```bash
cd backend && source .venv/bin/activate
pytest test_project3.py -v
```
Covers: ReAct parser, fallback agent, tool gating, SQL injection blocking, token blacklisting, account lockout, RBAC, conversation history, E2E flows.

## Demo Accounts
| Username | Password | Role | Tools | Blacklist |
|----------|----------|------|-------|-----------|
| admin | admin123 | super_admin | All 4 | Can revoke own token |
| manager | manager123 | admin | 3 | Can revoke own token |
| developer | dev123 | user | 2 | Can revoke own token |
| viewer | viewer123 | guest | 1 | Can revoke own token |
