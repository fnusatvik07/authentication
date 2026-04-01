import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, lazy, Suspense } from 'react'
import { Shield, Hash, Key, KeyRound, ShieldCheck, ChevronRight, Home, FolderCode, Menu, X, Network, Server, FileCode, Lock, RefreshCw, Database, Settings, Cpu, ShieldAlert, Bot, CheckCircle2, Circle } from 'lucide-react'
import Quiz from '../components/Quiz'
import ThemeToggle from '../components/ThemeToggle'
import SearchDialog from '../components/SearchDialog'
import Certificate from '../components/Certificate'
import ChapterFeedback from '../components/ChapterFeedback'
import { quizzes } from '../data/quizzes'
import { useProgress } from '../hooks/useProgress'

const Chapter1 = lazy(() => import('./chapters/Chapter1'))
const Chapter2 = lazy(() => import('./chapters/Chapter2'))
const Chapter3 = lazy(() => import('./chapters/Chapter3'))
const Chapter4 = lazy(() => import('./chapters/Chapter4'))
const Chapter5 = lazy(() => import('./chapters/Chapter5'))
const Chapter6 = lazy(() => import('./chapters/Chapter6'))
const Chapter7 = lazy(() => import('./chapters/Chapter7'))
const Chapter8 = lazy(() => import('./chapters/Chapter8'))
const Chapter9 = lazy(() => import('./chapters/Chapter9'))
const Chapter10 = lazy(() => import('./chapters/Chapter10'))
const Chapter11 = lazy(() => import('./chapters/Chapter11'))
const Chapter12 = lazy(() => import('./chapters/Chapter12'))
const Chapter13 = lazy(() => import('./chapters/Chapter13'))
const Chapter14 = lazy(() => import('./chapters/Chapter14'))
const Chapter15 = lazy(() => import('./chapters/Chapter15'))

const chapters = [
  { slug: 'how-web-works', title: 'How the Web Works', icon: Network, section: 'Foundations', component: Chapter1 },
  { slug: 'headers-cookies', title: 'Headers, Cookies & Requests', icon: FileCode, section: 'Foundations', component: Chapter2 },
  { slug: 'env-secrets', title: 'Environment Variables & Secrets', icon: Lock, section: 'Foundations', component: Chapter3 },
  { slug: 'api-design', title: 'API Design Fundamentals', icon: Server, section: 'Foundations', component: Chapter4 },
  { slug: 'authn-vs-authz', title: 'Authentication vs Authorization', icon: ShieldCheck, section: 'Core Concepts', component: Chapter5 },
  { slug: 'password-hashing', title: 'Password Hashing & Storage', icon: Hash, section: 'Core Concepts', component: Chapter6 },
  { slug: 'jwt', title: 'JWT Deep Dive', icon: Key, section: 'Core Concepts', component: Chapter7 },
  { slug: 'middleware', title: 'Middleware & Auth Guards', icon: Settings, section: 'Core Concepts', component: Chapter8 },
  { slug: 'rs256', title: 'RS256 Asymmetric JWT', icon: KeyRound, section: 'Intermediate', component: Chapter9 },
  { slug: 'rbac', title: 'RBAC & ABAC Patterns', icon: ShieldCheck, section: 'Intermediate', component: Chapter10 },
  { slug: 'refresh-tokens', title: 'Refresh Tokens & Rotation', icon: RefreshCw, section: 'Intermediate', component: Chapter11 },
  { slug: 'security-hardening', title: 'Security Hardening', icon: ShieldAlert, section: 'Advanced', component: Chapter12 },
  { slug: 'rag-auth', title: 'Authenticated RAG Systems', icon: Database, section: 'Advanced', component: Chapter13 },
  { slug: 'agentic-auth', title: 'Agentic Systems & Tool Auth', icon: Bot, section: 'Advanced', component: Chapter14 },
  { slug: 'production', title: 'Production & Operations', icon: Cpu, section: 'Advanced', component: Chapter15 },
]

const sections = [...new Set(chapters.map(t => t.section))]

export default function LearnPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const activeSlug = slug || chapters[0].slug
  const activeChapter = chapters.find(c => c.slug === activeSlug)
  const { markComplete, isComplete, completedCount } = useProgress()

  return (
    <div className="min-h-screen flex">
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 md:hidden p-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-sm">
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[var(--color-bg)] border-r border-[var(--color-border)] flex flex-col z-40 transition-transform md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-sm">
            <Shield size={16} /> AuthMasterclass
          </Link>
          <ThemeToggle />
        </div>
        <div className="px-3 py-2">
          <SearchDialog />
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="flex gap-1.5 mb-3 px-2">
            <Link to="/" className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1"><Home size={10} /> Home</Link>
            <span className="text-[var(--color-text-dim)]">·</span>
            <Link to="/projects" className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1"><FolderCode size={10} /> Projects</Link>
          </div>
          {sections.map(section => (
            <div key={section} className="mb-3">
              <h3 className="px-2 mb-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-dim)]">{section}</h3>
              {chapters.filter(t => t.section === section).map((ch, i) => {
                const active = ch.slug === activeSlug
                const Icon = ch.icon
                const globalIdx = chapters.indexOf(ch)
                const done = isComplete(ch.slug)
                return (
                  <button key={ch.slug} onClick={() => { navigate(`/learn/${ch.slug}`); setSidebarOpen(false); window.scrollTo(0,0) }}
                    className={`w-full flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[13px] text-left transition-all ${
                      active ? 'bg-[var(--color-primary-bg)] text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface2)]'
                    }`}>
                    {done
                      ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                      : <span className={`text-[10px] font-mono w-4 text-right flex-shrink-0 ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)]'}`}>{globalIdx + 1}</span>
                    }
                    <Icon size={13} className={active ? 'text-[var(--color-primary)]' : done ? 'text-emerald-500' : 'text-[var(--color-text-dim)]'} />
                    <span className="truncate">{ch.title}</span>
                    {active && <ChevronRight size={12} className="ml-auto flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="px-4 py-2 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--color-text-dim)]">Progress</span>
            <span className="text-[10px] font-semibold text-[var(--color-primary)]">{completedCount}/15</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--color-surface2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" style={{ width: `${(completedCount / 15) * 100}%` }} />
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-6 sm:py-10 max-w-none">
          <Suspense fallback={<div className="text-[var(--color-text-muted)] py-20 text-center">Loading chapter...</div>}>
            {activeChapter && <activeChapter.component />}
          </Suspense>

          {/* Quiz */}
          {quizzes[activeSlug] && (
            <div className="mt-12">
              <Quiz questions={quizzes[activeSlug]} />
            </div>
          )}

          {/* Feedback */}
          <ChapterFeedback slug={activeSlug} />

          {/* Mark complete button */}
          <div className="mt-8 flex items-center gap-4">
            {isComplete(activeSlug) ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle2 size={18} />
                Chapter completed
              </div>
            ) : (
              <button
                onClick={() => markComplete(activeSlug)}
                className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--color-primary-light)] transition-colors flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                Mark as Complete
              </button>
            )}
          </div>

          {/* Chapter navigation */}
          {(() => {
            const idx = chapters.findIndex(c => c.slug === activeSlug)
            const prev = idx > 0 ? chapters[idx - 1] : null
            const next = idx < chapters.length - 1 ? chapters[idx + 1] : null
            return (
              <div className="flex justify-between items-center pt-8 mt-12 border-t border-[var(--color-border)]">
                {prev ? (
                  <Link to={`/learn/${prev.slug}`} onClick={() => window.scrollTo(0,0)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                    ← {prev.title}
                  </Link>
                ) : <div />}
                {next ? (
                  <Link to={`/learn/${next.slug}`} onClick={() => window.scrollTo(0,0)} className="text-sm text-[var(--color-primary)] font-semibold">
                    {next.title} →
                  </Link>
                ) : (
                  <Link to="/projects" className="text-sm text-[var(--color-primary)] font-semibold">
                    Start Building →
                  </Link>
                )}
              </div>
            )
          })()}

          {/* Certificate - shows on last chapter */}
          {activeSlug === 'production' && (
            <div className="mt-12">
              <Certificate completedCount={completedCount} total={15} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
