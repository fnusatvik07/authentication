import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, FileText, FolderCode, BookOpen, Command } from 'lucide-react'

const searchIndex = [
  // Chapters
  { title: 'How the Web Works', path: '/learn/how-web-works', type: 'chapter', keywords: 'http request response status code get post' },
  { title: 'Headers, Cookies & Requests', path: '/learn/headers-cookies', type: 'chapter', keywords: 'authorization bearer cookie header content-type' },
  { title: 'Environment Variables & Secrets', path: '/learn/env-secrets', type: 'chapter', keywords: 'env dotenv secret key api key gitignore' },
  { title: 'API Design Fundamentals', path: '/learn/api-design', type: 'chapter', keywords: 'rest endpoint json pydantic register login' },
  { title: 'Authentication vs Authorization', path: '/learn/authn-vs-authz', type: 'chapter', keywords: '401 403 authn authz identity permission role' },
  { title: 'Password Hashing & Storage', path: '/learn/password-hashing', type: 'chapter', keywords: 'bcrypt salt hash cost factor argon2 sha256 rainbow table' },
  { title: 'JWT Deep Dive', path: '/learn/jwt', type: 'chapter', keywords: 'jwt token header payload signature claims exp iat jti sub access refresh' },
  { title: 'Middleware & Auth Guards', path: '/learn/middleware', type: 'chapter', keywords: 'depends fastapi oauth2 dependency injection guard' },
  { title: 'RS256 Asymmetric JWT', path: '/learn/rs256', type: 'chapter', keywords: 'rs256 rsa private key public key asymmetric cryptography microservice' },
  { title: 'RBAC & ABAC Patterns', path: '/learn/rbac', type: 'chapter', keywords: 'role based access control hierarchy permission admin user guest' },
  { title: 'Refresh Tokens & Rotation', path: '/learn/refresh-tokens', type: 'chapter', keywords: 'refresh token rotation revoke expiry short-lived long-lived' },
  { title: 'Security Hardening', path: '/learn/security-hardening', type: 'chapter', keywords: 'lockout brute force blacklist jti revocation password reset' },
  { title: 'Authenticated RAG Systems', path: '/learn/rag-auth', type: 'chapter', keywords: 'rag retrieval augmented generation vector database faiss chromadb pre-retrieval filtering' },
  { title: 'Agentic Systems & Tool Auth', path: '/learn/agentic-auth', type: 'chapter', keywords: 'react agent tool gating think act observe loop reasoning' },
  { title: 'Production & Operations', path: '/learn/production', type: 'chapter', keywords: 'production https cors rate limiting monitoring deployment docker' },
  // Projects
  { title: 'Project 1: Basic JWT Auth', path: '/projects/1', type: 'project', keywords: 'basic beginner hs256 register login protected lockout 45 tests' },
  { title: 'Project 2: RS256 RBAC Multi-Server', path: '/projects/2', type: 'project', keywords: 'rs256 rbac resource server auth server password reset refresh rotation 58 tests' },
  { title: 'Project 3: Agentic RAG', path: '/projects/3', type: 'project', keywords: 'react agent rag faiss chromadb blacklist jti audit logging 62 tests' },
  // Pages
  { title: 'Cheatsheet', path: '/cheatsheet', type: 'page', keywords: 'cheatsheet reference comparison table quick' },
  { title: 'API Playground', path: '/playground', type: 'page', keywords: 'playground api try request send test endpoint curl' },
]

export default function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Cmd+K listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) { inputRef.current?.focus(); setQuery(''); setSelectedIdx(0) }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return searchIndex.slice(0, 8)
    const terms = query.toLowerCase().split(/\s+/)
    return searchIndex
      .map(item => {
        const text = `${item.title} ${item.keywords}`.toLowerCase()
        const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0)
        return { ...item, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) {
      navigate(results[selectedIdx].path)
      setOpen(false)
    }
  }

  useEffect(() => { setSelectedIdx(0) }, [query])

  const icons = { chapter: BookOpen, project: FolderCode, page: FileText }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-dim)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)]/30 transition-colors">
        <Search size={13} />
        <span>Search...</span>
        <kbd className="ml-2 px-1.5 py-0.5 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded text-[10px] font-mono">
          <Command size={9} className="inline" />K
        </kbd>
      </button>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4" onClick={() => setOpen(false)}>
        <div className="w-full max-w-lg bg-[var(--color-bg)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <Search size={18} className="text-[var(--color-text-dim)] flex-shrink-0" />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]"
              placeholder="Search chapters, projects, concepts..." />
            <button onClick={() => setOpen(false)} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
              <X size={16} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No results found</div>
            ) : (
              results.map((item, i) => {
                const Icon = icons[item.type] || FileText
                return (
                  <button key={item.path}
                    onClick={() => { navigate(item.path); setOpen(false) }}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIdx ? 'bg-[var(--color-primary-bg)]' : 'hover:bg-[var(--color-surface)]'
                    }`}>
                    <Icon size={15} className={i === selectedIdx ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)]'} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${i === selectedIdx ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text)]'}`}>
                        {item.title}
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-dim)] capitalize flex-shrink-0">{item.type}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center gap-4 text-[10px] text-[var(--color-text-dim)]">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </div>
      </div>
    </>
  )
}
