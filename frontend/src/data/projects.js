export const projects = [
  {
    id: '1',
    title: 'Basic JWT Auth',
    difficulty: 'Beginner',
    difficultyColor: 'green',
    tests: 45,
    description: 'Simple JWT authentication with password hashing, protected routes, and account lockout.',
    stack: ['FastAPI', 'SQLite', 'PyJWT', 'bcrypt'],
    features: [
      { name: 'User Registration', desc: 'bcrypt password hashing with auto-salt' },
      { name: 'JWT Login', desc: 'HS256 symmetric token with 30-min expiry' },
      { name: 'Protected Routes', desc: 'Depends(get_current_user) pattern' },
      { name: 'Account Lockout', desc: '5 failed attempts → 15 min lock' },
    ],
    endpoints: [
      { method: 'POST', path: '/api/register', auth: 'None', desc: 'Register with username, email, password' },
      { method: 'POST', path: '/api/login', auth: 'None', desc: 'Returns JWT access token (with lockout)' },
      { method: 'GET', path: '/api/me', auth: 'JWT', desc: 'Current user profile' },
      { method: 'GET', path: '/api/protected', auth: 'JWT', desc: 'Example protected data' },
    ],
    architecture: `Frontend (HTML/JS)
       │
       │  POST /api/login {username, password}
       ▼
  FastAPI Server
       │
       │  1. Query SQLite for user
       │  2. bcrypt.checkpw(password, hash)
       │  3. jwt.encode({sub: username}, SECRET)
       │
       ▼
  Return: { access_token: "eyJ..." }`,
    keyLearnings: [
      'Password is NEVER stored - only the bcrypt hash',
      'JWT is stateless - server does not store sessions',
      'Token has expiry (exp claim) - 30 minutes default',
      'Bearer scheme - token sent in Authorization header',
      'Account lockout tracks failed_login_attempts in DB',
    ],
  },
  {
    id: '2',
    title: 'RS256 RBAC Multi-Server',
    difficulty: 'Intermediate',
    difficultyColor: 'orange',
    tests: 58,
    description: 'Asymmetric JWT (RS256) with separate auth/resource servers, role hierarchy, refresh rotation, password reset, and lockout.',
    stack: ['FastAPI', 'SQLite', 'PyJWT', 'bcrypt', 'cryptography (RSA)'],
    features: [
      { name: 'RS256 Asymmetric JWT', desc: 'Private key signs (auth server), public key verifies (resource server)' },
      { name: 'RBAC Hierarchy', desc: 'user → admin → super_admin with resource-level access' },
      { name: 'Refresh Token Rotation', desc: 'Old token revoked when new one is issued' },
      { name: 'Password Reset', desc: 'Secure token, single-use, 1-hour expiry' },
      { name: 'Account Lockout', desc: '5 attempts → 15 min lock, shows remaining attempts' },
      { name: 'Public Key Endpoint', desc: 'GET /api/public-key for resource server key distribution' },
    ],
    endpoints: [
      { method: 'POST', path: '/api/register', auth: 'None', desc: 'Register (role forced to user)' },
      { method: 'POST', path: '/api/login', auth: 'None', desc: 'Login with lockout protection' },
      { method: 'POST', path: '/api/refresh', auth: 'None', desc: 'Rotate refresh token pair' },
      { method: 'GET', path: '/api/public-key', auth: 'None', desc: 'RSA public key for verification' },
      { method: 'POST', path: '/api/password-reset/request', auth: 'None', desc: 'Request reset token' },
      { method: 'POST', path: '/api/password-reset/confirm', auth: 'None', desc: 'Reset with token + new password' },
      { method: 'GET', path: '/api/resources', auth: 'JWT', desc: 'RBAC-filtered resources' },
      { method: 'PUT', path: '/api/users/:id/role', auth: 'super_admin', desc: 'Change user role' },
    ],
    architecture: `  Auth Server (port 8000)          Resource Server (port 8001)
  ┌─────────────────────┐          ┌─────────────────────┐
  │ Has PRIVATE key      │          │ Has PUBLIC key only  │
  │                      │          │                      │
  │ jwt.encode(          │  token   │ jwt.decode(          │
  │   payload,           │ ──────▶  │   token,             │
  │   PRIVATE_KEY,       │          │   PUBLIC_KEY,        │
  │   algorithm="RS256"  │          │   algorithms=["RS256"]│
  │ )                    │          │ )                    │
  │                      │          │                      │
  │ ✅ Can sign tokens   │          │ ✅ Can verify tokens │
  │ ✅ Can forge tokens  │          │ ❌ Cannot forge      │
  └─────────────────────┘          └─────────────────────┘`,
    keyLearnings: [
      'RS256 = auth server signs, resource server ONLY verifies',
      'If resource server is compromised, attacker CANNOT forge tokens',
      'Refresh rotation: old token revoked every time → limits stolen token window',
      'Password reset uses separate one-time tokens (NOT JWTs)',
      'RBAC resources filtered server-side, not by hiding UI elements',
    ],
  },
  {
    id: '3',
    title: 'Agentic RAG + Auth',
    difficulty: 'Advanced',
    difficultyColor: 'purple',
    tests: 62,
    description: 'ReAct agent (Think→Act→Observe) with JWT-gated search tools, token blacklisting, FAISS/ChromaDB, and conversation memory.',
    stack: ['FastAPI', 'SQLite', 'PyJWT', 'bcrypt', 'FAISS', 'ChromaDB', 'OpenAI'],
    features: [
      { name: 'ReAct Agent Loop', desc: 'Think → Act (one tool) → Observe → repeat up to 5 steps' },
      { name: 'RBAC Tool Gating', desc: '4 tools, each requires minimum role. Enforced before AND inside loop.' },
      { name: 'Token Blacklisting', desc: 'Each JWT has JTI (UUID). Logout blacklists it. Instant revocation.' },
      { name: 'Vector Search', desc: 'FAISS (public) + ChromaDB (role-gated collections)' },
      { name: 'Conversation Memory', desc: 'Last 6 messages sent as context for multi-turn queries' },
      { name: 'Audit Logging', desc: 'Every query logged with user, role, tools, step count' },
    ],
    endpoints: [
      { method: 'POST', path: '/api/chat', auth: 'JWT', desc: 'ReAct agent query (with history)' },
      { method: 'POST', path: '/api/logout', auth: 'JWT', desc: 'Blacklist current access token' },
      { method: 'GET', path: '/api/tools', auth: 'JWT', desc: 'List tools for your role' },
      { method: 'GET', path: '/api/audit-log', auth: 'admin+', desc: 'Query audit trail' },
    ],
    architecture: `User (role: admin) ──▶ POST /api/chat
       │
       ▼
  JWT Verify + Blacklist Check
       │
       ▼
  ReAct Agent (Think → Act → Observe)
  ┌─────────────────────────────────────┐
  │ Step 1: THINK  "Need cost data"     │
  │ Step 2: ACT    admin_search(query)  │
  │ Step 3: OBSERVE results...          │
  │ Step 4: THINK  "Need more context"  │
  │ Step 5: ACT    public_search(query) │
  │ Step 6: OBSERVE results...          │
  │ Step 7: ANSWER synthesized response │
  └─────────────────────────────────────┘
       │
       ▼
  Tools (RBAC-gated):
  ✅ public_search   (FAISS)    - guest+
  ✅ internal_search  (ChromaDB) - user+
  ✅ admin_search     (ChromaDB) - admin+
  ❌ database_query   (SQLite)   - super_admin only`,
    keyLearnings: [
      'ReAct = Reason + Act. Agent thinks step-by-step, not all-at-once',
      'Tool gating: agent NEVER sees tools above user role level',
      'JTI blacklisting solves "JWT can\'t be revoked" problem',
      'Separate vector collections per access level = pre-retrieval filtering',
      'Conversation memory enables follow-up questions with context',
      'SQL injection blocked via keyword blacklist + semicolon blocking',
    ],
  },
]
