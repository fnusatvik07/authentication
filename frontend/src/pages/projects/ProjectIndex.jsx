import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, FlaskConical } from 'lucide-react'
import { projects } from '../../data/projects'
import Navbar from '../../components/Navbar'

const diffColors = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}

const gradients = {
  green: 'from-emerald-500 to-emerald-600',
  orange: 'from-orange-500 to-orange-600',
  purple: 'from-purple-500 to-purple-600',
}

export default function ProjectIndex() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <Link to="/" className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-primary)] flex items-center gap-1 mb-6">
          <ArrowLeft size={14} /> Home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Projects</h1>
        <p className="text-[var(--color-text-muted)] mb-10">
          Three progressively complex projects. Each builds on the security concepts from the previous one.
        </p>

        <div className="space-y-5">
          {projects.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={`/projects/${p.id}`}
                className="block bg-white border border-[var(--color-border)] rounded-2xl p-7 hover:shadow-lg hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradients[p.difficultyColor]} text-white flex items-center justify-center font-bold text-xl flex-shrink-0 shadow-sm`}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold group-hover:text-indigo-600 transition-colors">{p.title}</h2>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${diffColors[p.difficultyColor]}`}>{p.difficulty}</span>
                      <span className="text-xs text-[var(--color-text-dim)] flex items-center gap-1 ml-1">
                        <FlaskConical size={12} /> {p.tests} tests
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] mb-3">{p.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.stack.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-md text-[var(--color-text-dim)]">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-[var(--color-text-dim)] group-hover:text-indigo-600 transition-colors mt-2 flex-shrink-0" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
