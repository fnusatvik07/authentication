# Project 2: RS256 RBAC Multi-Server Authentication

## Overview
A production-grade role-based access control system with **asymmetric JWT (RS256)**, separate auth and resource servers, refresh token rotation, account lockout, and password reset.

## What You'll Learn
- **RS256 (asymmetric JWT)** — auth server signs with private key, resource server verifies with public key
- Why RS256 is critical for microservices (resource servers can't forge tokens)
- Role hierarchy: `user` → `admin` → `super_admin`
- Refresh token rotation for secure long-lived sessions
- Account lockout after 5 failed login attempts (brute-force protection)
- Password reset flow with secure one-time tokens
- Resource-level access control (public, user, admin, super_admin)
- Public key distribution endpoint (`/api/public-key`)

## Architecture
```
Frontend ──→ Auth Server (port 8000)          Resource Server (port 8001)
               │ Signs with PRIVATE key           │ Verifies with PUBLIC key
               │                                  │
               ├── POST /api/register             ├── GET /api/resources
               ├── POST /api/login (lockout)      ├── GET /api/resources/:id
               ├── POST /api/refresh              ├── POST /api/resources
               ├── GET  /api/me                   └── GET /api/categories
               ├── GET  /api/public-key ─────────→ (fetches public key)
               ├── POST /api/password-reset/request
               ├── POST /api/password-reset/confirm
               ├── GET  /api/users (admin+)
               └── PUT  /api/users/:id/role (super_admin)
```

## RS256 vs HS256 — Why This Matters

| | HS256 (Project 1) | RS256 (Project 2) |
|---|---|---|
| **Key type** | Shared secret | Public/Private key pair |
| **Who can sign** | Anyone with the secret | Only auth server (private key) |
| **Who can verify** | Anyone with the secret | Anyone (public key is safe to share) |
| **If resource server compromised** | Attacker can forge tokens | Attacker can only verify, not forge |
| **Best for** | Single server | Microservices, distributed systems |

## Security Features

| Feature | Description |
|---------|-------------|
| **RS256 JWT** | Asymmetric signing — private key never leaves auth server |
| **Account lockout** | 5 failed attempts → 15 min lockout |
| **Password reset** | Token-based, single-use, 1-hour expiry |
| **Refresh rotation** | Old refresh token revoked on each refresh |
| **RBAC** | Hierarchical roles with resource-level access |

## Setup
```bash
# Terminal 1: Auth Server (generates RSA keys on first run)
cd backend/auth_server
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
python main.py  # port 8000

# Terminal 2: Resource Server (uses auth server's public key)
cd backend/resource_server
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
python main.py  # port 8001
```

Open `frontend/index.html` in your browser.

**Default super_admin:** `admin` / `admin123`

## Tests (58 passing)
```bash
cd backend/auth_server
source .venv/bin/activate
pytest test_project2.py -v
```
Covers: RS256 verification, RBAC, lockout, password reset, refresh rotation, resource access, E2E flows.
