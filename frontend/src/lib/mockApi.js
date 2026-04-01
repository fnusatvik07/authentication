/**
 * Mock API Engine — simulates a real auth backend entirely in the browser.
 *
 * This teaches authentication by showing real response shapes, status codes,
 * headers, and error messages — without needing a running backend.
 *
 * Simulates: registration, login (with lockout), JWT tokens, protected routes,
 * RBAC, refresh tokens, password reset, token blacklisting, and the RAG agent.
 */

// ── State (in-memory "database") ─────────────────────

let users = [
  { id: 1, username: 'alice', email: 'alice@example.com', passwordHash: '$2b$12$mock...alice', role: 'admin', department: 'engineering', failedAttempts: 0, lockedUntil: null },
  { id: 2, username: 'bob', email: 'bob@example.com', passwordHash: '$2b$12$mock...bob', role: 'user', department: 'design', failedAttempts: 0, lockedUntil: null },
  { id: 3, username: 'viewer', email: 'viewer@example.com', passwordHash: '$2b$12$mock...viewer', role: 'guest', department: 'general', failedAttempts: 0, lockedUntil: null },
]

// Plaintext passwords for mock verification (in real system: only hashes exist)
const passwords = { alice: 'admin123', bob: 'bob123', viewer: 'view123' }

let nextId = 4
let tokens = {} // jti → { username, role, exp }
let blacklist = new Set()
let refreshTokens = {} // token → { username, role }

const resources = [
  { id: 1, title: 'Company Overview', content: 'We build AI search solutions.', access_level: 'public', category: 'general' },
  { id: 2, title: 'Product Pricing', content: 'Free tier: 1000 queries/mo. Pro: $99/mo.', access_level: 'public', category: 'business' },
  { id: 3, title: 'Q2 Roadmap', content: 'Multi-modal search, real-time indexing.', access_level: 'user', category: 'product' },
  { id: 4, title: 'Code Review Policy', content: 'All PRs need 2 approvals.', access_level: 'user', category: 'engineering' },
  { id: 5, title: 'AWS Costs', content: 'EC2: $25k/mo, S3: $8k/mo. Total: $50k/mo.', access_level: 'admin', category: 'finance' },
  { id: 6, title: 'Incident Playbook', content: 'Step 1: Isolate. Step 2: Contain.', access_level: 'admin', category: 'security' },
  { id: 7, title: 'Board Notes', content: 'Revenue grew 40% YoY. Planning Series C.', access_level: 'super_admin', category: 'executive' },
]

const ROLE_LEVEL = { guest: 0, user: 1, admin: 2, super_admin: 3 }
const ACCESS_LEVEL = { public: 0, user: 1, admin: 2, super_admin: 3 }

// ── Token helpers ────────────────────────────────────

function makeJti() {
  return 'jti-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
}

function makeToken(username, role) {
  const jti = makeJti()
  const exp = Date.now() + 30 * 60 * 1000 // 30 min
  const iat = Date.now()
  tokens[jti] = { username, role, exp }

  // Build a fake but realistic-looking JWT (3 base64 parts)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '')
  const payload = btoa(JSON.stringify({ sub: username, role, exp: Math.floor(exp / 1000), iat: Math.floor(iat / 1000), jti, type: 'access' })).replace(/=/g, '')
  const sig = btoa('mock-signature-' + jti).replace(/=/g, '').slice(0, 43)
  return `${header}.${payload}.${sig}`
}

function makeRefreshToken(username, role) {
  const rt = 'rt-' + Math.random().toString(36).slice(2, 18)
  refreshTokens[rt] = { username, role }
  return rt
}

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1]))
    if (blacklist.has(payload.jti)) return { error: 401, detail: 'Token has been revoked (JTI blacklisted)', _learn: 'This token was blacklisted when the user called POST /api/logout. The JTI was added to the blacklist table.' }
    if (payload.exp * 1000 < Date.now()) return { error: 401, detail: 'Token has expired', _learn: 'JWT exp claim is in the past. The user needs to refresh or re-login.' }
    return payload
  } catch {
    return { error: 401, detail: 'Invalid token format' }
  }
}

// ── Route handler ────────────────────────────────────

function delay() {
  return new Promise(r => setTimeout(r, 80 + Math.random() * 120))
}

export async function mockFetch(method, path, body, headers = {}) {
  await delay() // Simulate network latency

  const auth = headers['Authorization'] || headers['authorization'] || ''

  // ── POST /api/register ──
  if (method === 'POST' && path === '/api/register') {
    if (!body?.username || !body?.email || !body?.password) {
      return res(422, { detail: 'Missing required fields: username, email, password' }, 'Pydantic validation would catch this. All fields are required in UserRegister model.')
    }
    if (users.find(u => u.username === body.username || u.email === body.email)) {
      return res(400, { detail: 'Username or email already exists' }, 'The database has a UNIQUE constraint on both columns.')
    }
    const user = {
      id: nextId++,
      username: body.username,
      email: body.email,
      passwordHash: '$2b$12$' + Math.random().toString(36).slice(2, 24) + '...',
      role: 'user',
      department: body.department || 'general',
      failedAttempts: 0,
      lockedUntil: null,
    }
    users.push(user)
    passwords[user.username] = body.password
    return res(201, { id: user.id, username: user.username, email: user.email, role: 'user', department: user.department },
      'Password was hashed with bcrypt (cost=12) before storage. The response never includes the password or hash.')
  }

  // ── POST /api/login ──
  if (method === 'POST' && path === '/api/login') {
    const user = users.find(u => u.username === body?.username)
    if (!user) return res(401, { detail: 'Invalid credentials' }, 'User not found. We return the same generic message whether username or password is wrong (prevents username enumeration).')

    // Lockout check
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000)
      return res(423, { detail: `Account locked. Try again in ${mins} minutes.` },
        `Account locked after ${user.failedAttempts} failed attempts. locked_until is set in the database. Even the correct password is rejected.`)
    }

    if (passwords[user.username] !== body?.password) {
      user.failedAttempts++
      if (user.failedAttempts >= 5) {
        user.lockedUntil = Date.now() + 15 * 60 * 1000
        return res(423, { detail: 'Account locked after 5 failed attempts. Try again in 15 minutes.' },
          'failed_login_attempts reached 5. locked_until set to now + 15 minutes. This prevents brute-force attacks.')
      }
      return res(401, { detail: `Invalid credentials (${5 - user.failedAttempts} attempts remaining)` },
        `bcrypt.checkpw() returned False. failed_login_attempts incremented to ${user.failedAttempts}.`)
    }

    // Success
    user.failedAttempts = 0
    user.lockedUntil = null
    const access = makeToken(user.username, user.role)
    const refresh = makeRefreshToken(user.username, user.role)
    return res(200, { access_token: access, refresh_token: refresh, token_type: 'bearer' },
      'Password verified via bcrypt.checkpw(). JWT created with sub, role, exp (30min), jti (unique ID for blacklisting). Refresh token stored in DB.')
  }

  // ── GET /api/me ──
  if (method === 'GET' && path === '/api/me') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn || 'No Authorization header, or token is invalid/expired. Send: Authorization: Bearer <token>')
    const user = users.find(u => u.username === payload.sub)
    if (!user) return res(404, { detail: 'User not found' }, 'Token was valid but the user was deleted from the database.')
    return res(200, { id: user.id, username: user.username, email: user.email, role: user.role, department: user.department },
      'JWT decoded successfully. sub claim used to look up user in database. No password ever returned.')
  }

  // ── GET /api/protected ──
  if (method === 'GET' && path === '/api/protected') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn)
    return res(200, { message: `Hello ${payload.sub}! You have access to this protected resource.`, user_role: payload.role },
      'The Depends(get_current_user) dependency verified the JWT before this code ran.')
  }

  // ── GET /api/resources ──
  if (method === 'GET' && path === '/api/resources') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn)
    const level = ROLE_LEVEL[payload.role] ?? 0
    const accessible = resources.filter(r => ACCESS_LEVEL[r.access_level] <= level)
    const levels = Object.entries(ACCESS_LEVEL).filter(([, v]) => v <= level).map(([k]) => k)
    return res(200, { user: payload.sub, role: payload.role, accessible_levels: levels, count: accessible.length, resources: accessible },
      `Role "${payload.role}" (level ${level}) can see ${levels.join(', ')} resources. Server-side filtering — client never receives restricted data.`)
  }

  // ── GET /api/tools ──
  if (method === 'GET' && path === '/api/tools') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn)
    const level = ROLE_LEVEL[payload.role] ?? 0
    const toolMap = { public_search: 'guest', internal_search: 'user', admin_search: 'admin', database_query: 'super_admin' }
    const tools = Object.entries(toolMap).map(([name, minRole]) => ({
      name, required_role: minRole, accessible: ROLE_LEVEL[minRole] <= level,
    }))
    return res(200, { user_role: payload.role, tools },
      `Each tool has a minimum role. The agent only receives tools where ROLE_LEVEL[min_role] <= ROLE_LEVEL[user_role].`)
  }

  // ── POST /api/chat ──
  if (method === 'POST' && path === '/api/chat') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn)
    const level = ROLE_LEVEL[payload.role] ?? 0
    const query = body?.message || 'hello'

    const steps = [
      { step: 1, type: 'thought', content: `I need to find information about "${query}". Let me check which tools I have access to as a ${payload.role}.` },
      { step: 2, type: 'observation', content: level >= 2
        ? 'Found relevant results in admin_search: AWS costs $50k/mo, security policies updated.'
        : 'Found relevant results in public_search: Product info, pricing details.', tool: level >= 2 ? 'admin_search' : 'public_search', result_count: 3 },
      { step: 3, type: 'thought', content: 'I have enough information to answer the question.' },
    ]
    const toolsUsed = level >= 2 ? ['public_search', 'admin_search'] : ['public_search']
    const answer = level >= 2
      ? `Based on admin docs: ${query.includes('cost') || query.includes('AWS') ? 'Total monthly AWS spend is $50,000 (EC2 $25k, S3 $8k, RDS $12k, Lambda $3k, CloudFront $2k).' : 'I found relevant internal information to answer your question.'}`
      : `Based on public docs: ${query.includes('product') || query.includes('pricing') ? 'We offer a free tier (1000 queries/mo) and Pro ($99/mo).' : 'I found relevant public information to answer your question.'}`

    return res(200, {
      answer, tools_used: toolsUsed,
      sources: [{ content: 'Retrieved from mock vector DB', source: toolsUsed[0], tool: toolsUsed[0], access_level: level >= 2 ? 'admin' : 'public' }],
      reasoning_steps: steps, user_role: payload.role,
    }, `ReAct loop: ${steps.length} steps. Tools filtered by role "${payload.role}" BEFORE the loop started. Agent could only use: ${toolsUsed.join(', ')}.`)
  }

  // ── POST /api/refresh ──
  if (method === 'POST' && path === '/api/refresh') {
    const rt = body?.refresh_token
    if (!rt || !refreshTokens[rt]) return res(401, { detail: 'Invalid refresh token' }, 'Refresh token not found in database, or already revoked.')
    const { username, role } = refreshTokens[rt]
    delete refreshTokens[rt] // Rotation: revoke old
    const newAccess = makeToken(username, role)
    const newRefresh = makeRefreshToken(username, role)
    return res(200, { access_token: newAccess, refresh_token: newRefresh, token_type: 'bearer' },
      'Old refresh token REVOKED (rotation). New pair issued. If attacker stole the old token, it\'s now useless.')
  }

  // ── POST /api/logout ──
  if (method === 'POST' && path === '/api/logout') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn)
    blacklist.add(payload.jti)
    return res(200, { message: 'Logged out — token revoked' },
      `JTI "${payload.jti}" added to blacklist. This specific token is now permanently rejected, even before its exp time.`)
  }

  // ── POST /api/password-reset/request ──
  if (method === 'POST' && path === '/api/password-reset/request') {
    const resetToken = 'rst-' + Math.random().toString(36).slice(2, 18)
    return res(200, { message: 'If the email exists, a reset link has been sent.', _debug_reset_token: resetToken },
      'Same message whether email exists or not (anti-enumeration). Token hash stored in DB with 1-hour expiry. In production: sent via email.')
  }

  // ── GET /api/public-key ──
  if (method === 'GET' && path === '/api/public-key') {
    return res(200, { public_key: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----', algorithm: 'RS256' },
      'Safe to expose. Resource servers fetch this to verify JWTs. They can verify tokens but CANNOT sign/forge new ones.')
  }

  // ── GET /api/roles ──
  if (method === 'GET' && path === '/api/roles') {
    return res(200, { roles: { user: 1, admin: 2, super_admin: 3 } }, 'Hierarchical: super_admin > admin > user. Higher roles inherit all lower permissions.')
  }

  // ── GET /api/users (admin+) ──
  if (method === 'GET' && path === '/api/users') {
    const payload = verifyToken(auth)
    if (!payload || payload.error) return res(payload?.error || 401, { detail: payload?.detail || 'Not authenticated' }, payload?._learn)
    if ((ROLE_LEVEL[payload.role] ?? 0) < 2) return res(403, { detail: "Requires 'admin' role or higher" }, '403 Forbidden — user IS authenticated but NOT authorized. Their role level is below admin (2).')
    return res(200, users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, department: u.department })),
      'Admin+ endpoint. require_role("admin") checked the JWT role claim before this code ran.')
  }

  // ── GET /api/health ──
  if (method === 'GET' && path === '/api/health') {
    return res(200, { status: 'healthy', service: 'mock-api', mode: 'simulated' }, 'Health check — no auth required. Always returns 200.')
  }

  // ── 404 ──
  return res(404, { detail: `${method} ${path} not found` }, `This endpoint doesn't exist. Check the API docs for available routes.`)
}

function res(status, data, _learn) {
  const statusTexts = { 200: 'OK', 201: 'Created', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 422: 'Validation Error', 423: 'Locked' }
  // Handle both object and array responses
  const responseData = Array.isArray(data) ? { items: data, _learn } : { ...data, _learn }
  return { status, statusText: statusTexts[status] || 'Unknown', data: responseData }
}

// Reset state
export function resetMockState() {
  users = [
    { id: 1, username: 'alice', email: 'alice@example.com', passwordHash: '$2b$12$mock...alice', role: 'admin', department: 'engineering', failedAttempts: 0, lockedUntil: null },
    { id: 2, username: 'bob', email: 'bob@example.com', passwordHash: '$2b$12$mock...bob', role: 'user', department: 'design', failedAttempts: 0, lockedUntil: null },
    { id: 3, username: 'viewer', email: 'viewer@example.com', passwordHash: '$2b$12$mock...viewer', role: 'guest', department: 'general', failedAttempts: 0, lockedUntil: null },
  ]
  passwords.alice = 'admin123'
  passwords.bob = 'bob123'
  passwords.viewer = 'view123'
  nextId = 4
  tokens = {}
  blacklist = new Set()
  refreshTokens = {}
}
