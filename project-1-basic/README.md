# Project 1: Basic JWT Authentication

## Overview
A simple JWT authentication system with FastAPI backend and vanilla HTML/JS frontend.

## What You'll Learn
- Password hashing with bcrypt
- JWT token creation and validation
- Protected API endpoints with FastAPI dependencies
- OAuth2 Password Bearer flow
- SQLite for user storage

## Architecture
```
Frontend (HTML/JS)  →  FastAPI Backend  →  SQLite Database
     │                      │
     │ POST /api/login      │
     │─────────────────────>│ Verify password hash
     │                      │ Create JWT token
     │ { access_token }     │
     │<─────────────────────│
     │                      │
     │ GET /api/me          │
     │ Authorization: Bearer│ Decode JWT
     │─────────────────────>│ Extract user info
     │ { user profile }     │
     │<─────────────────────│
```

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Register new user |
| POST | `/api/login` | No | Login, get JWT token |
| GET | `/api/me` | JWT | Get current user profile |
| GET | `/api/protected` | JWT | Access protected data |
| GET | `/api/health` | No | Health check |

## Setup
```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
python main.py
```

Open `frontend/index.html` in your browser.

## Key Concepts
1. **Password is never stored** — only the bcrypt hash
2. **JWT is stateless** — server doesn't store sessions
3. **Token has expiry** — 30 minutes by default
4. **Bearer scheme** — token sent in `Authorization` header
