import { describe, it, expect, beforeEach } from 'vitest'
import { mockFetch, resetMockState } from '../lib/mockApi'

beforeEach(() => resetMockState())

describe('Mock API — Registration', () => {
  it('registers a new user', async () => {
    const res = await mockFetch('POST', '/api/register', { username: 'newuser', email: 'new@test.com', password: 'pass123' })
    expect(res.status).toBe(201)
    expect(res.data.username).toBe('newuser')
    expect(res.data.role).toBe('user')
    expect(res.data.password).toBeUndefined()
  })

  it('rejects duplicate username', async () => {
    const res = await mockFetch('POST', '/api/register', { username: 'alice', email: 'new@test.com', password: 'pass' })
    expect(res.status).toBe(400)
    expect(res.data.detail).toMatch(/already exists/)
  })

  it('rejects missing fields', async () => {
    const res = await mockFetch('POST', '/api/register', { username: 'test' })
    expect(res.status).toBe(422)
  })
})

describe('Mock API — Login', () => {
  it('returns tokens on valid login', async () => {
    const res = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    expect(res.status).toBe(200)
    expect(res.data.access_token).toBeDefined()
    expect(res.data.refresh_token).toBeDefined()
    expect(res.data.token_type).toBe('bearer')
  })

  it('rejects wrong password', async () => {
    const res = await mockFetch('POST', '/api/login', { username: 'alice', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.data.detail).toMatch(/remaining/)
  })

  it('locks account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await mockFetch('POST', '/api/login', { username: 'bob', password: 'wrong' })
    }
    const res = await mockFetch('POST', '/api/login', { username: 'bob', password: 'bob123' })
    expect(res.status).toBe(423)
    expect(res.data.detail).toMatch(/locked/i)
  })

  it('resets failed counter on success', async () => {
    await mockFetch('POST', '/api/login', { username: 'alice', password: 'wrong' })
    await mockFetch('POST', '/api/login', { username: 'alice', password: 'wrong' })
    const res = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    expect(res.status).toBe(200)
  })
})

describe('Mock API — Protected Routes', () => {
  it('rejects request without token', async () => {
    const res = await mockFetch('GET', '/api/me', null, {})
    expect(res.status).toBe(401)
  })

  it('returns profile with valid token', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const res = await mockFetch('GET', '/api/me', null, { Authorization: `Bearer ${login.data.access_token}` })
    expect(res.status).toBe(200)
    expect(res.data.username).toBe('alice')
    expect(res.data.role).toBe('admin')
  })

  it('rejects invalid token', async () => {
    const res = await mockFetch('GET', '/api/me', null, { Authorization: 'Bearer invalid.token.here' })
    expect(res.status).toBe(401)
  })
})

describe('Mock API — RBAC', () => {
  it('admin sees admin-level resources', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const res = await mockFetch('GET', '/api/resources', null, { Authorization: `Bearer ${login.data.access_token}` })
    expect(res.status).toBe(200)
    expect(res.data.accessible_levels).toContain('admin')
    expect(res.data.resources.length).toBeGreaterThan(4)
  })

  it('guest only sees public resources', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'viewer', password: 'view123' })
    const res = await mockFetch('GET', '/api/resources', null, { Authorization: `Bearer ${login.data.access_token}` })
    expect(res.status).toBe(200)
    expect(res.data.accessible_levels).toEqual(['public'])
    res.data.resources.forEach(r => expect(r.access_level).toBe('public'))
  })

  it('user cannot list all users (admin+ only)', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'bob', password: 'bob123' })
    const res = await mockFetch('GET', '/api/users', null, { Authorization: `Bearer ${login.data.access_token}` })
    expect(res.status).toBe(403)
  })

  it('admin can list all users', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const res = await mockFetch('GET', '/api/users', null, { Authorization: `Bearer ${login.data.access_token}` })
    expect(res.status).toBe(200)
    expect(res.data.items.length).toBeGreaterThanOrEqual(3)
    expect(res.data._learn).toBeDefined()
  })
})

describe('Mock API — Token Blacklisting', () => {
  it('logout blacklists the token', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const token = login.data.access_token
    // Token works before logout
    const before = await mockFetch('GET', '/api/me', null, { Authorization: `Bearer ${token}` })
    expect(before.status).toBe(200)
    // Logout
    await mockFetch('POST', '/api/logout', null, { Authorization: `Bearer ${token}` })
    // Token rejected after logout
    const after = await mockFetch('GET', '/api/me', null, { Authorization: `Bearer ${token}` })
    expect(after.status).toBe(401)
    expect(after.data.detail).toMatch(/revoked|blacklisted/i)
  })

  it('new token works after logout', async () => {
    const login1 = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    await mockFetch('POST', '/api/logout', null, { Authorization: `Bearer ${login1.data.access_token}` })
    const login2 = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const res = await mockFetch('GET', '/api/me', null, { Authorization: `Bearer ${login2.data.access_token}` })
    expect(res.status).toBe(200)
  })
})

describe('Mock API — Refresh Tokens', () => {
  it('refresh returns new token pair', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const res = await mockFetch('POST', '/api/refresh', { refresh_token: login.data.refresh_token })
    expect(res.status).toBe(200)
    expect(res.data.access_token).toBeDefined()
    expect(res.data.refresh_token).not.toBe(login.data.refresh_token)
  })

  it('old refresh token is revoked after use', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    await mockFetch('POST', '/api/refresh', { refresh_token: login.data.refresh_token })
    const res = await mockFetch('POST', '/api/refresh', { refresh_token: login.data.refresh_token })
    expect(res.status).toBe(401)
  })
})

describe('Mock API — Learning Explanations', () => {
  it('every response includes a _learn field', async () => {
    const reg = await mockFetch('POST', '/api/register', { username: 'test', email: 't@t.com', password: 'p' })
    expect(reg.data._learn).toBeDefined()
    expect(reg.data._learn.length).toBeGreaterThan(20)

    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    expect(login.data._learn).toBeDefined()

    const me = await mockFetch('GET', '/api/me', null, { Authorization: `Bearer ${login.data.access_token}` })
    expect(me.data._learn).toBeDefined()

    const fail = await mockFetch('POST', '/api/login', { username: 'alice', password: 'wrong' })
    expect(fail.data._learn).toMatch(/bcrypt/)
  })
})

describe('Mock API — Chat (ReAct Agent)', () => {
  it('returns reasoning steps and tools used', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'alice', password: 'admin123' })
    const res = await mockFetch('POST', '/api/chat', { message: 'What are our AWS costs?' }, { Authorization: `Bearer ${login.data.access_token}` })
    expect(res.status).toBe(200)
    expect(res.data.reasoning_steps.length).toBeGreaterThan(0)
    expect(res.data.tools_used.length).toBeGreaterThan(0)
    expect(res.data.answer).toBeDefined()
  })

  it('guest only gets public tools', async () => {
    const login = await mockFetch('POST', '/api/login', { username: 'viewer', password: 'view123' })
    const res = await mockFetch('GET', '/api/tools', null, { Authorization: `Bearer ${login.data.access_token}` })
    const accessible = res.data.tools.filter(t => t.accessible)
    expect(accessible.length).toBe(1)
    expect(accessible[0].name).toBe('public_search')
  })
})
