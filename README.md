<h1 align="center">Auth Masterclass</h1>

<p align="center">
  <strong>The only authentication course you'll ever need.</strong>
  <br/>
  Password hashing to agentic RAG. 15 chapters. 3 projects. 191 tests.
</p>

<p align="center">
  <a href="https://fnusatvik07.github.io/authentication/">Live Demo</a> · <a href="#chapters">Chapters</a> · <a href="#projects">Projects</a> · <a href="#quick-start">Quick Start</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-191_passing-22c55e?style=flat-square" />
  <img src="https://img.shields.io/badge/chapters-15-6366f1?style=flat-square" />
  <img src="https://img.shields.io/badge/projects-3-a855f7?style=flat-square" />
  <img src="https://img.shields.io/badge/python-3.12-fbbf24?style=flat-square" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square" />
</p>

<br/>

## What This Is

A complete learning platform that teaches JWT authentication through real, tested code. Not a blog post. Not a video tutorial. An interactive course with a React frontend, three backend projects, quizzes, an API playground, and a guided tutorial that works entirely in your browser.

<br/>

<h2 id="chapters">Chapters</h2>

> Each chapter opens with a story, explains the "why" before the "how," and includes diagrams, code examples, and a quiz.

| | Chapter | What You'll Understand |
|:---:|---------|----------------------|
| 1 | How the Web Works | HTTP requests, responses, methods, status codes |
| 2 | Headers & Cookies | Authorization header, Bearer tokens, cookie tradeoffs |
| 3 | Environment Variables | Why secrets leak, .env pattern, secret rotation |
| 4 | API Design | REST auth endpoints, Pydantic validation, response shapes |
| 5 | AuthN vs AuthZ | 401 vs 403, identity vs permission, the two-step pipeline |
| 6 | Password Hashing | bcrypt internals, salting, cost factors, timing attacks |
| 7 | JWT Deep Dive | Three-part structure, claims, signed ≠ encrypted |
| 8 | Middleware & Guards | FastAPI Depends(), request pipeline, auth dependency chains |
| 9 | RS256 Asymmetric JWT | Private key signs, public key verifies, microservice pattern |
| 10 | RBAC Patterns | Role hierarchies, resource filtering, require_role() |
| 11 | Refresh Tokens | Token rotation, stolen token detection, storage strategies |
| 12 | Security Hardening | Account lockout, JTI blacklisting, password reset |
| 13 | Authenticated RAG | Pre-retrieval filtering, vector DB per access level |
| 14 | Agentic Tool Auth | ReAct loop, RBAC tool gating, double enforcement |
| 15 | Production Ops | HTTPS, rate limiting, key rotation, deployment checklist |

<br/>

<h2 id="projects">Projects</h2>

> Each project builds on the previous one. By Project 3, you have a production-grade authenticated AI agent.

| | Project | Stack | Key Features | Tests |
|:---:|---------|-------|-------------|:-----:|
| 1 | **Basic JWT** | FastAPI, SQLite, PyJWT, bcrypt | HS256 tokens, password hashing, account lockout | 45 |
| 2 | **RS256 RBAC** | + cryptography, two servers | Asymmetric JWT, role hierarchy, password reset, refresh rotation | 58 |
| 3 | **Agentic RAG** | + FAISS, ChromaDB, OpenAI | ReAct agent, RBAC tool gating, JTI blacklisting, audit logging | 62 |

<br/>

## Interactive Features

The React frontend includes tools that make learning active, not passive.

| Feature | What It Does |
|---------|-------------|
| **Guided Tutorial** | 9-step walkthrough of the complete auth flow. No backend needed. |
| **API Playground** | Send real requests to a simulated backend. Every response explains what happened. |
| **JWT Decoder** | Paste any token. See header, payload, signature decoded and annotated. |
| **Chapter Quizzes** | 50+ questions with explanations. Test yourself after each chapter. |
| **Progress Tracking** | Checkmarks and progress bar. Pick up where you left off. |
| **Completion Certificate** | Finish all 15 chapters. Download a PNG certificate with your name. |
| **Search** | Cmd+K to find any chapter, project, or concept. |
| **Dark Mode** | Toggle with system preference detection. |

<br/>

<h2 id="quick-start">Quick Start</h2>

**Frontend (the learning site)**

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

**Backend (Project 1)**

```bash
cd project-1-basic/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
# http://localhost:8000/docs
```

**Run all tests**

```bash
# Backend (165 tests)
cd project-1-basic/backend && pytest -v
cd project-2-medium/backend/auth_server && pytest -v
cd project-3-advanced/backend && pytest -v

# Frontend (26 tests)
cd frontend && npx vitest run
```

<br/>

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | FastAPI, SQLite, PyJWT, bcrypt, cryptography |
| Vector DB | FAISS, ChromaDB |
| LLM | OpenAI API (gpt-4o-mini) |
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion, Mermaid |
| Testing | pytest, Vitest, React Testing Library |
| CI/CD | GitHub Actions, GitHub Pages, Docker Compose |

<br/>

## Project Structure

```
├── frontend/                    React learning site
│   ├── src/pages/chapters/      15 chapter components
│   ├── src/pages/projects/      3 project walkthroughs
│   ├── src/components/          JWT decoder, playground, quiz, search
│   └── src/lib/mockApi.js       Simulated backend (runs in browser)
│
├── project-1-basic/             HS256 + lockout
├── project-2-medium/            RS256 + RBAC + password reset
│   ├── backend/auth_server/     Signs with private key
│   └── backend/resource_server/ Verifies with public key
├── project-3-advanced/          ReAct RAG + blacklisting
│   ├── backend/rag_agent/       Think → Act → Observe loop
│   └── backend/vector_db/       FAISS + ChromaDB setup
│
├── learning-resources/          Standalone markdown reference
├── docker-compose.yml           Run everything with one command
└── .github/workflows/           CI + GitHub Pages deploy
```

<br/>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Open an issue or PR.

## License

MIT
