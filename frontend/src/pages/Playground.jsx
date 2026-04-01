import { useState } from 'react'
import Navbar from '../components/Navbar'
import APIPlayground from '../components/APIPlayground'
import GuidedTutorial from '../components/GuidedTutorial'

export default function Playground() {
  const [tab, setTab] = useState('guided')

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-3xl font-bold mb-2">API Playground</h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          Learn authentication by doing. No backend needed - everything runs in your browser.
        </p>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-8">
          <button onClick={() => setTab('guided')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'guided'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/30'
            }`}>
            🎓 Guided Tutorial
          </button>
          <button onClick={() => setTab('free')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === 'free'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/30'
            }`}>
            ⚡ Free-Form Playground
          </button>
        </div>

        {tab === 'guided' && (
          <>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[13px] text-amber-800 mb-6 flex items-start gap-2">
              <span className="text-base">🎯</span>
              <div>
                <strong>9 steps</strong> walking you through the complete JWT auth flow: registration → login → token usage → RBAC → lockout → tool gating → token blacklisting. Each step explains what's happening on the server and what to look for in the response.
              </div>
            </div>
            <GuidedTutorial />
          </>
        )}

        {tab === 'free' && (
          <>
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-[13px] text-purple-800 mb-6 flex items-start gap-2">
              <span className="text-base">🧪</span>
              <div>
                <strong>Simulated mode</strong> - try any endpoint with any data. Auto-captures JWT from login. Pre-built users: <code className="bg-purple-100 px-1 rounded">alice/admin123</code> (admin), <code className="bg-purple-100 px-1 rounded">bob/bob123</code> (user), <code className="bg-purple-100 px-1 rounded">viewer/view123</code> (guest). Uncheck "Simulated mode" to hit a real backend.
              </div>
            </div>
            <APIPlayground baseUrl="http://localhost:8000" />
          </>
        )}
      </div>
    </div>
  )
}
