import { useParams, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ArrowLeft, FlaskConical, Server, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { projects } from '../../data/projects'
import CodeBlock from '../../components/CodeBlock'
import Navbar from '../../components/Navbar'

const Project1 = lazy(() => import('./walkthroughs/Project1'))
const Project2 = lazy(() => import('./walkthroughs/Project2'))
const Project3 = lazy(() => import('./walkthroughs/Project3'))

const walkthroughs = { '1': Project1, '2': Project2, '3': Project3 }

const gradients = {
  green: 'from-emerald-500 to-emerald-600',
  orange: 'from-orange-500 to-orange-600',
  purple: 'from-purple-500 to-purple-600',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const project = projects.find(p => p.id === id)

  if (!project) {
    return <div className="max-w-4xl mx-auto px-6 py-24"><p>Project not found.</p><Link to="/projects" className="text-[var(--color-primary)]">Back</Link></div>
  }

  const idx = projects.indexOf(project)
  const Walkthrough = walkthroughs[id]

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero banner */}
      <div className={`pt-14 bg-gradient-to-br ${gradients[project.difficultyColor]} text-white`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-12 py-12">
          <Link to="/projects" className="text-white/60 hover:text-white text-sm flex items-center gap-1 mb-4">
            <ArrowLeft size={14} /> All Projects
          </Link>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 sm:gap-4 mb-3">
              <span className="text-4xl sm:text-6xl font-bold font-mono opacity-20">{String(idx + 1).padStart(2, '0')}</span>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold">{project.title}</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-white/80 text-xs sm:text-sm">
                  <span className="flex items-center gap-1"><FlaskConical size={14} /> {project.tests} tests</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="flex items-center gap-1"><Server size={14} /> {project.stack.join(' + ')}</span>
                </div>
              </div>
            </div>
            <p className="text-white/80 text-sm sm:text-lg max-w-3xl mt-3 sm:mt-4 leading-relaxed">{project.description}</p>
          </motion.div>
        </div>
      </div>

      {/* Full walkthrough content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-12 py-8">
        <Suspense fallback={<div className="py-20 text-center text-[var(--color-text-muted)]">Loading walkthrough...</div>}>
          {Walkthrough && <Walkthrough />}
        </Suspense>

        {/* How to Run */}
        <section className="mt-12 mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Play size={22} className="text-emerald-500" /> How to Run</h2>
          <CodeBlock title="Setup and start" language="bash" code={
            project.id === '2'
              ? `# Terminal 1: Auth Server
cd project-2-medium/backend/auth_server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py  # Port 8000 — generates RSA keys on first run

# Terminal 2: Resource Server
cd project-2-medium/backend/resource_server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py  # Port 8001 — loads public key from auth server

# Run tests
pytest test_project2.py -v  # 58 tests

# Default admin: admin / admin123`
              : project.id === '3'
              ? `cd project-3-advanced/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Initialize vector databases (run once)
python -m vector_db.setup_vectordb

# Start server
python main.py  # Port 8000

# Run tests
pytest test_project3.py -v  # 62 tests

# Demo accounts:
#   admin/admin123 (super_admin — 4 tools)
#   manager/mgr123 (admin — 3 tools)
#   developer/dev123 (user — 2 tools)
#   viewer/view123 (guest — 1 tool)`
              : `cd project-1-basic/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py  # Port 8000

# Run tests
pytest test_project1.py -v  # 45 tests

# Open frontend/index.html in browser
# Register a new account to test`
          } />
        </section>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-8 mt-8 border-t border-[var(--color-border)]">
          {idx > 0 ? (
            <Link to={`/projects/${projects[idx - 1].id}`} onClick={() => window.scrollTo(0,0)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1">
              <ArrowLeft size={14} /> Project {idx}: {projects[idx - 1].title}
            </Link>
          ) : (
            <Link to="/learn" onClick={() => window.scrollTo(0,0)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Learning
            </Link>
          )}
          {idx < projects.length - 1 ? (
            <Link to={`/projects/${projects[idx + 1].id}`} onClick={() => window.scrollTo(0,0)} className="text-sm text-[var(--color-primary)] font-semibold flex items-center gap-1">
              Project {idx + 2}: {projects[idx + 1].title} →
            </Link>
          ) : (
            <Link to="/" onClick={() => window.scrollTo(0,0)} className="text-sm text-[var(--color-primary)] font-semibold">
              Back to Home →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
