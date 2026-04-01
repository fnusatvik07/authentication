import { useState } from 'react'
import { Play, CheckCircle2, ChevronRight, RotateCcw, Lightbulb, ArrowRight } from 'lucide-react'
import { mockFetch, resetMockState } from '../lib/mockApi'

const STEPS = [
  {
    id: 1,
    title: 'Register a new user',
    description: 'Every auth system starts here. The server hashes the password with bcrypt and stores only the hash — never the plaintext.',
    method: 'POST',
    path: '/api/register',
    body: { username: 'demo', email: 'demo@example.com', password: 'SecureP@ss123' },
    expectStatus: 201,
    whatToNotice: 'The response contains id, username, email, role — but NO password. The server stored a bcrypt hash internally, but never returns it.',
  },
  {
    id: 2,
    title: 'Login to get a JWT token',
    description: 'Send credentials. The server verifies the password against the stored bcrypt hash, then creates a signed JWT containing your identity and role.',
    method: 'POST',
    path: '/api/login',
    body: { username: 'demo', password: 'SecureP@ss123' },
    expectStatus: 200,
    whatToNotice: 'You get an access_token (JWT, 30-min expiry) and a refresh_token (for getting new access tokens without re-logging in). The access_token is a Base64-encoded string with three dot-separated parts.',
    captureToken: true,
  },
  {
    id: 3,
    title: 'Access a protected endpoint',
    description: 'Now use the JWT token to prove your identity. The server decodes the token, verifies the signature, checks expiry, and extracts your username.',
    method: 'GET',
    path: '/api/me',
    body: null,
    needsAuth: true,
    expectStatus: 200,
    whatToNotice: 'The server knew you were "demo" without a database lookup — your identity was embedded in the JWT payload. This is what "stateless" means.',
  },
  {
    id: 4,
    title: 'Try without a token (get rejected)',
    description: 'What happens if you forget the Authorization header? The server has no way to know who you are.',
    method: 'GET',
    path: '/api/me',
    body: null,
    needsAuth: false,
    expectStatus: 401,
    whatToNotice: '401 Unauthorized — "Not authenticated." The server cannot identify you without a valid JWT. This is AuthN failure (authentication, not authorization).',
  },
  {
    id: 5,
    title: 'Try a wrong password (see lockout counter)',
    description: 'What happens when someone tries to brute-force a password? The server tracks failed attempts.',
    method: 'POST',
    path: '/api/login',
    body: { username: 'alice', password: 'totally-wrong' },
    expectStatus: 401,
    whatToNotice: 'Notice "X attempts remaining" in the error. After 5 wrong attempts, the account locks for 15 minutes. Even the correct password is rejected while locked.',
  },
  {
    id: 6,
    title: 'See RBAC in action — resources filtered by role',
    description: 'Different roles see different data. Your "demo" account has role "user" — you\'ll see public and user-level resources, but NOT admin or super_admin content.',
    method: 'GET',
    path: '/api/resources',
    body: null,
    needsAuth: true,
    expectStatus: 200,
    whatToNotice: 'Look at accessible_levels — you can only see "public" and "user" resources. Admin docs (costs, security) are filtered out server-side. The client never even receives them.',
  },
  {
    id: 7,
    title: 'Check which tools the ReAct agent can use',
    description: 'In Project 3, the AI agent has search tools gated by role. Your role determines which tools the agent has access to.',
    method: 'GET',
    path: '/api/tools',
    body: null,
    needsAuth: true,
    expectStatus: 200,
    whatToNotice: 'As a "user" role, you get public_search and internal_search (accessible: true). admin_search and database_query show accessible: false — the agent literally cannot use them.',
  },
  {
    id: 8,
    title: 'Logout — blacklist your token',
    description: 'JWTs are stateless — the server can\'t "delete" them. But with JTI blacklisting, logout adds the token\'s unique ID to a blacklist. Every future request checks it.',
    method: 'POST',
    path: '/api/logout',
    body: null,
    needsAuth: true,
    expectStatus: 200,
    whatToNotice: 'Your token\'s JTI was added to the blacklist. If you try to use this same token again (Step 9), it will be rejected — even though it hasn\'t expired yet.',
    blacklistsToken: true,
  },
  {
    id: 9,
    title: 'Try the blacklisted token (get rejected)',
    description: 'The same token that worked in Step 3 should now be rejected. The server checks the blacklist on every request.',
    method: 'GET',
    path: '/api/me',
    body: null,
    needsAuth: true,
    expectStatus: 401,
    whatToNotice: '"Token has been revoked" — the JTI blacklist caught it. This solves the biggest JWT criticism: "you can\'t revoke a JWT." You can, with JTI blacklisting.',
  },
]

export default function GuidedTutorial() {
  const [currentStep, setCurrentStep] = useState(0)
  const [results, setResults] = useState({})
  const [token, setToken] = useState('')
  const [running, setRunning] = useState(false)

  const step = STEPS[currentStep]
  const result = results[currentStep]
  const completed = Object.keys(results).length

  const runStep = async () => {
    setRunning(true)
    const headers = {}
    if (step.needsAuth && token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await mockFetch(step.method, step.path, step.body, headers)

    if (step.captureToken && res.data?.access_token) {
      setToken(res.data.access_token)
    }

    setResults(prev => ({ ...prev, [currentStep]: res }))
    setRunning(false)
  }

  const handleReset = () => {
    resetMockState()
    setResults({})
    setToken('')
    setCurrentStep(0)
  }

  const methodColors = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
  }

  const statusColor = (s) =>
    s >= 200 && s < 300 ? 'bg-emerald-100 text-emerald-700' :
    s >= 400 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'

  return (
    <div className="border border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-5 py-3 bg-[var(--color-surface2)] border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-[var(--color-text)]">Guided Tutorial</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
            Step {currentStep + 1} of {STEPS.length}
          </span>
        </div>
        <button onClick={handleReset} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1">
          <RotateCcw size={11} /> Restart
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--color-surface2)]">
        <div className="h-full bg-[var(--color-primary)] transition-all duration-300" style={{ width: `${((currentStep + (result ? 1 : 0)) / STEPS.length) * 100}%` }} />
      </div>

      {/* Step selector */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex gap-1.5 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setCurrentStep(i)}
            className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
              results[i]
                ? 'bg-emerald-100 text-emerald-700'
                : i === currentStep
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface2)] text-[var(--color-text-dim)]'
            }`}>
            {results[i] ? <CheckCircle2 size={14} /> : i + 1}
          </button>
        ))}
      </div>

      {/* Current step */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColors[step.method]}`}>{step.method}</span>
          <span className="font-mono text-sm text-[var(--color-text)]">{step.path}</span>
        </div>
        <h3 className="text-lg font-bold text-[var(--color-text)] mb-1">{step.title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">{step.description}</p>

        {step.body && (
          <pre className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[12px] font-mono mb-4 text-[var(--color-text-secondary)]">
            {JSON.stringify(step.body, null, 2)}
          </pre>
        )}

        {step.needsAuth && (
          <div className="text-[11px] text-[var(--color-text-dim)] mb-3 flex items-center gap-1">
            🔑 Authorization: Bearer {token ? token.slice(0, 30) + '...' : '(no token yet — complete step 2 first)'}
          </div>
        )}

        <button onClick={runStep} disabled={running || (step.needsAuth && !token && step.id > 2)}
          className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--color-primary-light)] transition-colors flex items-center gap-2 disabled:opacity-40">
          {running ? 'Running...' : 'Run this step'}
          <Play size={14} />
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="border-t border-[var(--color-border)]">
          <div className="px-4 py-2 bg-[var(--color-surface2)] flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor(result.status)}`}>
              {result.status} {result.statusText}
            </span>
            {result.status === step.expectStatus
              ? <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Expected result</span>
              : <span className="text-[11px] text-orange-600 font-medium">Unexpected status (expected {step.expectStatus})</span>
            }
          </div>

          {/* What to notice */}
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex gap-2">
            <Lightbulb size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-900 leading-relaxed"><strong>What to notice:</strong> {step.whatToNotice}</p>
          </div>

          {/* Server explanation */}
          {result.data?._learn && (
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex gap-2">
              <span className="text-sm flex-shrink-0">🖥️</span>
              <p className="text-[12px] text-indigo-800 leading-relaxed"><strong>Server:</strong> {result.data._learn}</p>
            </div>
          )}

          <pre className="p-4 text-[12px] font-mono bg-[var(--color-surface)] overflow-x-auto max-h-48 overflow-y-auto leading-relaxed text-[var(--color-text-secondary)]">
            {JSON.stringify(Object.fromEntries(Object.entries(result.data).filter(([k]) => k !== '_learn')), null, 2)}
          </pre>

          {/* Next step button */}
          {currentStep < STEPS.length - 1 && (
            <div className="px-4 py-3 border-t border-[var(--color-border)]">
              <button onClick={() => setCurrentStep(currentStep + 1)}
                className="text-sm text-[var(--color-primary)] font-semibold hover:underline flex items-center gap-1">
                Next: {STEPS[currentStep + 1].title} <ArrowRight size={14} />
              </button>
            </div>
          )}

          {currentStep === STEPS.length - 1 && (
            <div className="px-4 py-4 border-t border-[var(--color-border)] bg-emerald-50 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-800">Tutorial complete!</p>
              <p className="text-xs text-emerald-700 mt-1">You've walked through the entire JWT auth flow: register → login → use token → RBAC → lockout → tool gating → blacklisting.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
