<p align="center">
  <img src="https://img.shields.io/badge/tests-191%20passing-brightgreen" />
  <img src="https://img.shields.io/badge/chapters-15-blue" />
  <img src="https://img.shields.io/badge/projects-3-purple" />
  <img src="https://img.shields.io/badge/python-3.12-yellow" />
  <img src="https://img.shields.io/badge/react-19-61dafb" />
</p>

# Auth Masterclass

Learn authentication from scratch. 15 chapters that take you from "what is HTTP" to building a production-grade ReAct RAG agent with role-gated search tools, token blacklisting, and 191 passing tests.

Not slides. Not blog posts. Real code you can run, test, and modify.

## What's Inside

**15 Chapters** covering every layer of authentication:

| # | Chapter | What You Learn |
|---|---------|----------------|
| 1 | How the Web Works | HTTP request/response, methods, status codes |
| 2 | Headers & Cookies | Authorization header, Bearer scheme, cookie vs header |
| 3 | Environment Variables | Secret management, .env pattern, why keys leak |
| 4 | API Design | REST auth patterns, Pydantic validation, response shapes |
| 5 | AuthN vs AuthZ | 401 vs 403, identity vs permissions, the two-step pipeline |
| 6 | Password Hashing | bcrypt internals, salting, cost factors, timing attacks |
| 7 | JWT Deep Dive | Token structure, claims, signed ≠ encrypted, PyJWT |
| 8 | Middleware & Guards | FastAPI Depends(), request pipeline, auth chains |
| 9 | RS256 Asymmetric JWT | Private key signs, public key verifies, microservice pattern |
| 10 | RBAC Patterns | Role hierarchy, resource-level filtering, require_role() |
| 11 | Refresh Tokens | Token rotation, stolen token detection, storage strategies |
| 12 | Security Hardening | Account lockout, JTI blacklisting, password reset flow |
| 13 | Authenticated RAG | Pre-retrieval filtering, vector DB per access level |
| 14 | Agentic Tool Auth | ReAct loop, RBAC tool gating, double enforcement |
| 15 | Production Ops | HTTPS, rate limiting, key rotation, deployment checklist |

**3 Projects** with increasing complexity:

| Project | What You Build | Key Features | Tests |
|---------|---------------|--------------|-------|
| **Basic JWT** | Single-server auth with FastAPI | bcrypt, HS256 JWT, account lockout | 45 |
| **RS256 RBAC** | Two-server architecture | Asymmetric JWT, role hierarchy, password reset, refresh rotation | 58 |
| **Agentic RAG** | AI agent with authenticated search | ReAct loop, FAISS + ChromaDB, JTI blacklisting, audit logging | 62 |

**Interactive Frontend** built with React:

| Feature | Description |
|---------|-------------|
| Guided Tutorial | 9-step walkthrough of the entire auth flow (no backend needed) |
| API Playground | Send requests to a simulated backend with teaching explanations |
| JWT Decoder | Paste any token, see decoded header/payload/signature |
| Chapter Quizzes | 50+ questions with explanations |
| Progress Tracking | Checkmarks, progress bar, completion certificate |
| Search | Cmd+K to find any chapter or concept |
| Dark Mode | Toggle with system preference detection |
| Cheatsheet | Single-page quick reference for all auth patterns |

## Quick Start

```bash
# Frontend (learning site)
cd frontend
npm install
npm run dev
# Open http://localhost:5173

# Backend (Project 1)
cd project-1-basic/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
# Open http://localhost:8000/docs
```

## Run Tests

```bash
# All backend tests (165)
cd project-1-basic/backend && pytest test_project1.py -v
cd project-2-medium/backend/auth_server && pytest test_project2.py -v
cd project-3-advanced/backend && pytest test_project3.py -v

# Frontend tests (26)
cd frontend && npx vitest run
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLite, PyJWT, bcrypt, cryptography (RS256) |
| Vector DB | FAISS (public search), ChromaDB (role-gated search) |
| LLM | OpenAI API (gpt-4o-mini for ReAct agent) |
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion, Mermaid |
| Testing | pytest (backend), Vitest (frontend) |
| CI/CD | GitHub Actions (4 parallel jobs) |
| Deploy | Docker Compose, Vercel, GitHub Pages |

## Project Structure

```
authentication/
├── frontend/                  React learning site (15 chapters, playground, quizzes)
├── project-1-basic/           HS256 JWT + account lockout (45 tests)
├── project-2-medium/          RS256 + RBAC + password reset (58 tests)
│   ├── backend/auth_server/   Signs tokens with private key
│   └── backend/resource_server/ Verifies with public key only
├── project-3-advanced/        ReAct RAG + token blacklisting (62 tests)
│   ├── backend/auth_service/  JWT + RBAC + JTI blacklist
│   ├── backend/rag_agent/     ReAct loop (Think → Act → Observe)
│   └── backend/vector_db/    FAISS + ChromaDB setup
├── learning-resources/        Standalone markdown reference docs
├── docker-compose.yml         Run everything with one command
└── .github/workflows/         CI: runs all 191 tests on every PR
```

## Security Features by Project

```
Project 1          Project 2              Project 3
Basic              Medium                 Advanced

bcrypt             bcrypt                 bcrypt
HS256 JWT          RS256 JWT              HS256 + JTI blacklist
Account lockout    Account lockout        Account lockout
                   Password reset
                   Refresh rotation       Refresh rotation
                   Public key endpoint    Token revocation
                                          ReAct agent
                                          RBAC tool gating
                                          Audit logging
                                          SQL injection blocking
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
