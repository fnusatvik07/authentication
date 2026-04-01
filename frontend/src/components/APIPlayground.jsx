import { useState } from 'react'
import { Play, Copy, Check, ChevronDown, Loader2, Lightbulb, RotateCcw } from 'lucide-react'
import { mockFetch, resetMockState } from '../lib/mockApi'

const PRESETS = [
  {
    name: 'Register a user',
    method: 'POST',
    url: '/api/register',
    body: '{\n  "username": "testuser",\n  "email": "test@example.com",\n  "password": "MySecureP@ss123"\n}',
    auth: false,
    description: 'Creates a new user account. Returns the user profile (no password).',
  },
  {
    name: 'Login',
    method: 'POST',
    url: '/api/login',
    body: '{\n  "username": "testuser",\n  "password": "MySecureP@ss123"\n}',
    auth: false,
    description: 'Returns a JWT access token. Copy it and use it in subsequent requests.',
  },
  {
    name: 'Get my profile',
    method: 'GET',
    url: '/api/me',
    body: '',
    auth: true,
    description: 'Returns the authenticated user\'s profile. Requires a valid JWT.',
  },
  {
    name: 'Access protected route',
    method: 'GET',
    url: '/api/protected',
    body: '',
    auth: true,
    description: 'Example protected endpoint. Returns a greeting if JWT is valid.',
  },
  {
    name: 'Login with wrong password',
    method: 'POST',
    url: '/api/login',
    body: '{\n  "username": "testuser",\n  "password": "wrongpassword"\n}',
    auth: false,
    description: 'Try logging in with a wrong password. You\'ll get a 401. Do it 5 times to trigger account lockout (423).',
  },
  {
    name: 'Request without token',
    method: 'GET',
    url: '/api/me',
    body: '',
    auth: false,
    description: 'Call a protected endpoint without a token. You\'ll get a 401 "Not authenticated".',
  },
]

const methodColors = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function APIPlayground({ baseUrl = 'http://localhost:8000', className = '' }) {
  const [method, setMethod] = useState('POST')
  const [url, setUrl] = useState('/api/register')
  const [body, setBody] = useState('{\n  "username": "testuser",\n  "email": "test@example.com",\n  "password": "MySecureP@ss123"\n}')
  const [token, setToken] = useState('')
  const [useAuth, setUseAuth] = useState(false)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [useMock, setUseMock] = useState(true) // Default to mock - works without backend

  const sendRequest = async () => {
    setLoading(true)
    setResponse(null)
    const startTime = Date.now()

    const reqHeaders = { 'Content-Type': 'application/json' }
    if (useAuth && token) reqHeaders['Authorization'] = `Bearer ${token}`

    let parsedBody = null
    if (method !== 'GET' && body.trim()) {
      try { parsedBody = JSON.parse(body) } catch { parsedBody = body }
    }

    // Try real backend first, fall back to mock
    let result
    let usedMock = false
    if (useMock) {
      result = await mockFetch(method, url, parsedBody, reqHeaders)
      usedMock = true
    } else {
      try {
        const options = { method, headers: reqHeaders }
        if (method !== 'GET' && body.trim()) options.body = body
        const res = await fetch(`${baseUrl}${url}`, options)
        const data = await res.json().catch(() => res.text())
        result = { status: res.status, statusText: res.statusText, data }
      } catch {
        // Backend not running → use mock
        result = await mockFetch(method, url, parsedBody, reqHeaders)
        usedMock = true
      }
    }

    const duration = Date.now() - startTime

    // Auto-capture token
    if (result.data?.access_token && !token) {
      setToken(result.data.access_token)
      setUseAuth(true)
    }

    setResponse({ ...result, duration, mock: usedMock })
    setLoading(false)
  }

  const loadPreset = (preset) => {
    setMethod(preset.method)
    setUrl(preset.url)
    setBody(preset.body)
    setUseAuth(preset.auth)
    setPresetsOpen(false)
    setResponse(null)
  }

  const copyToken = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusColor = response
    ? response.status >= 200 && response.status < 300 ? 'text-emerald-600 bg-emerald-50'
    : response.status >= 400 && response.status < 500 ? 'text-orange-600 bg-orange-50'
    : response.status >= 500 ? 'text-red-600 bg-red-50'
    : 'text-gray-600 bg-gray-50'
    : ''

  return (
    <div className={`border border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-bg)] ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 bg-[var(--color-surface2)] border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <Play size={16} className="text-[var(--color-primary)]" />
          API Playground
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${useMock ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {useMock ? 'SIMULATED' : 'LIVE'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" checked={useMock} onChange={e => setUseMock(e.target.checked)} className="rounded border-[var(--color-border)] text-purple-500" />
            Simulated mode
          </label>
          <button onClick={() => { resetMockState(); setToken(''); setResponse(null) }} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1" title="Reset mock database">
            <RotateCcw size={11} /> Reset
          </button>
          <div className="relative">
            <button onClick={() => setPresetsOpen(!presetsOpen)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1">
              Presets <ChevronDown size={12} />
            </button>
            {presetsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPresetsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-xl z-20 py-1 max-h-80 overflow-y-auto">
                  {PRESETS.map((p, i) => (
                    <button key={i} onClick={() => loadPreset(p)} className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface2)] transition-colors">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColors[p.method]}`}>{p.method}</span>
                        <span className="text-xs font-mono text-[var(--color-text)]">{p.url}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{p.description}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Request builder */}
      <div className="p-4 space-y-3">
        {/* Method + URL */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm font-semibold focus:outline-none focus:border-[var(--color-primary)]">
              {['GET', 'POST', 'PUT', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input value={url} onChange={e => setUrl(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
              placeholder="/api/endpoint" />
          </div>
          <button onClick={sendRequest} disabled={loading}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-primary-light)] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Send
          </button>
        </div>

        {/* Auth toggle + token */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer flex-shrink-0">
            <input type="checkbox" checked={useAuth} onChange={e => setUseAuth(e.target.checked)}
              className="rounded border-[var(--color-border)]" />
            Include Authorization header
          </label>
          {useAuth && (
            <div className="flex-1 flex items-center gap-2">
              <input value={token} onChange={e => setToken(e.target.value)} placeholder="Paste JWT token (auto-captured from login)"
                className="flex-1 px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] font-mono focus:outline-none focus:border-[var(--color-primary)]" />
              {token && <button onClick={copyToken} className="text-[var(--color-text-dim)] hover:text-[var(--color-primary)]">
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>}
            </div>
          )}
        </div>
        {token && !useAuth && (
          <div className="text-[11px] text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
            Token auto-captured from login. Check "Include Authorization header" to use it.
          </div>
        )}

        {/* Body */}
        {method !== 'GET' && (
          <textarea value={body} onChange={e => setBody(e.target.value)}
            className="w-full h-28 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[13px] font-mono resize-none focus:outline-none focus:border-[var(--color-primary)] leading-relaxed"
            placeholder="Request body (JSON)" spellCheck={false} />
        )}
      </div>

      {/* Response */}
      {response && (
        <div className="border-t border-[var(--color-border)]">
          <div className="px-4 py-2 bg-[var(--color-surface2)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor}`}>
                {response.status} {response.statusText}
              </span>
              <span className="text-[11px] text-[var(--color-text-dim)]">{response.duration}ms</span>
              {response.mock && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">SIMULATED</span>}
            </div>
          </div>

          {/* Learn callout - the teaching moment */}
          {response.data?._learn && (
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex gap-2">
              <Lightbulb size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-indigo-800 leading-relaxed">{response.data._learn}</p>
            </div>
          )}

          <pre className="p-4 text-[13px] font-mono bg-[var(--color-surface)] overflow-x-auto max-h-64 overflow-y-auto leading-relaxed text-[var(--color-text-secondary)]">
            {typeof response.data === 'string' ? response.data : JSON.stringify(
              // Hide _learn from JSON display (it's shown in the callout above)
              Object.fromEntries(Object.entries(response.data).filter(([k]) => k !== '_learn')),
              null, 2
            )}
          </pre>
        </div>
      )}
    </div>
  )
}
