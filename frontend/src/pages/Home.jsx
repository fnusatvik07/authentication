import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, BookOpen, FolderCode, ArrowRight, CheckCircle2, Lock, Key, Bot, KeyRound, ShieldCheck, Hash, Zap, FlaskConical } from 'lucide-react'
import Navbar from '../components/Navbar'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' } }),
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-14 overflow-hidden">
        {/* Gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/80 via-white to-white" />
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-100/50 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium mb-6">
              <Zap size={14} />
              15 chapters · 165 tests · 3 projects · Zero deprecated deps
            </div>
          </motion.div>

          <motion.h1
            className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-[var(--color-text)] mb-5 leading-[1.1]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Authenticate Everything.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              APIs. Agents. RAG.
            </span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg md:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Learn how to secure APIs, protect RAG pipelines, and build AI agents
            with role-gated tools. From bcrypt to ReAct. Everything tested.
          </motion.p>

          <motion.div
            className="flex gap-3 justify-center flex-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link
              to="/learn"
              className="px-5 sm:px-7 py-3 sm:py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200 text-sm sm:text-base"
            >
              <BookOpen size={18} />
              Start Learning
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/projects"
              className="px-5 sm:px-7 py-3 sm:py-3.5 bg-white border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <FolderCode size={18} />
              View Projects
            </Link>
          </motion.div>

          {/* Tech badges */}
          <motion.div
            className="flex gap-2 justify-center flex-wrap mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {['PyJWT', 'bcrypt', 'RS256', 'FastAPI', 'FAISS', 'ChromaDB', 'SQLite', 'pytest'].map(t => (
              <span key={t} className="px-2.5 py-1 bg-white border border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-muted)] font-medium">
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 -mt-4 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '165', label: 'Tests Passing', icon: FlaskConical, color: 'text-emerald-600' },
            { value: '15', label: 'Chapters', icon: BookOpen, color: 'text-indigo-600' },
            { value: '3', label: 'Full Projects', icon: FolderCode, color: 'text-purple-600' },
            { value: '0', label: 'Deprecated Deps', icon: CheckCircle2, color: 'text-emerald-600' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="bg-white border border-[var(--color-border)] rounded-2xl p-6 text-center hover:shadow-md transition-shadow"
            >
              <s.icon size={20} className={`mx-auto mb-2 ${s.color}`} />
              <div className="text-3xl font-bold text-[var(--color-text)]">{s.value}</div>
              <div className="text-sm text-[var(--color-text-muted)] mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What You'll Master */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">What You'll Master</h2>
        <p className="text-[var(--color-text-muted)] text-center mb-10 max-w-xl mx-auto">
          Each concept builds on the previous one. By the end, you'll understand production auth.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Hash, title: 'Password Hashing', desc: 'bcrypt internals, salting, cost factors, constant-time comparison', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            { icon: Key, title: 'JWT Tokens', desc: 'HS256 symmetric signing, claims, expiry, refresh rotation', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
            { icon: KeyRound, title: 'RS256 Asymmetric', desc: 'Private key signs, public key verifies. Microservice-safe.', color: 'bg-orange-50 text-orange-600 border-orange-100' },
            { icon: ShieldCheck, title: 'RBAC', desc: 'Role hierarchies, resource-level access, Depends() pattern', color: 'bg-blue-50 text-blue-600 border-blue-100' },
            { icon: Lock, title: 'Security Patterns', desc: 'Account lockout, token blacklisting, password reset', color: 'bg-red-50 text-red-600 border-red-100' },
            { icon: Bot, title: 'Agentic RAG', desc: 'ReAct loop with RBAC-gated search tools and audit logging', color: 'bg-purple-50 text-purple-600 border-purple-100' },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="bg-white border border-[var(--color-border)] rounded-2xl p-6 hover:shadow-md hover:border-indigo-200 transition-all"
            >
              <div className={`inline-flex p-2.5 rounded-xl border mb-4 ${f.color}`}>
                <f.icon size={20} />
              </div>
              <h3 className="font-bold text-[var(--color-text)] mb-1.5">{f.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Learning Path */}
      <section className="bg-[var(--color-surface)] border-y border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-center mb-10">Learning Path</h2>
          <div className="space-y-4">
            {[
              { step: '01', title: 'Read the Docs', desc: 'Password hashing → JWT → RS256 → RBAC → Security → RAG Auth', link: '/learn', gradient: 'from-emerald-500 to-emerald-600' },
              { step: '02', title: 'Project 1: Basic JWT', desc: 'Registration, login, protected routes, account lockout — 45 tests', link: '/projects/1', gradient: 'from-indigo-500 to-indigo-600' },
              { step: '03', title: 'Project 2: RS256 + RBAC', desc: 'Asymmetric JWT, multi-server, refresh rotation, password reset — 58 tests', link: '/projects/2', gradient: 'from-orange-500 to-orange-600' },
              { step: '04', title: 'Project 3: ReAct RAG Agent', desc: 'Think→Act→Observe loop, tool gating, token blacklisting — 62 tests', link: '/projects/3', gradient: 'from-purple-500 to-purple-600' },
            ].map((item, i) => (
              <motion.div key={item.step} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Link
                  to={item.link}
                  className="flex items-center gap-5 p-5 bg-white border border-[var(--color-border)] rounded-2xl hover:shadow-md hover:border-indigo-200 transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm`}>
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--color-text)] group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] truncate">{item.desc}</p>
                  </div>
                  <ArrowRight size={18} className="text-[var(--color-text-dim)] group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Progression */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">Security Feature Progression</h2>
        <p className="text-[var(--color-text-muted)] text-center mb-10">Each project adds more security layers</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-sm">
          {[
            { title: 'Project 1', subtitle: 'Basic', color: 'border-emerald-200 bg-emerald-50/30', features: ['bcrypt hashing', 'HS256 JWT', 'Account lockout'] },
            { title: 'Project 2', subtitle: 'Medium', color: 'border-orange-200 bg-orange-50/30', features: ['+ RS256 asymmetric', '+ Password reset', '+ Refresh rotation', '+ Public key endpoint'] },
            { title: 'Project 3', subtitle: 'Advanced', color: 'border-purple-200 bg-purple-50/30', features: ['+ Token blacklisting', '+ ReAct agent loop', '+ RBAC tool gating', '+ Audit logging', '+ SQL injection blocking'] },
          ].map((p, i) => (
            <motion.div
              key={p.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className={`rounded-2xl border p-6 ${p.color}`}
            >
              <h3 className="font-bold text-lg">{p.title}</h3>
              <p className="text-[var(--color-text-muted)] text-xs mb-3">{p.subtitle}</p>
              <ul className="space-y-1.5">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to learn auth the right way?</h2>
          <p className="text-indigo-100 mb-8 max-w-lg mx-auto">
            Start with the fundamentals, build three real projects, and understand every security pattern.
          </p>
          <Link
            to="/learn"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-xl shadow-indigo-900/20"
          >
            <BookOpen size={18} />
            Start Learning
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center text-sm text-[var(--color-text-dim)]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[var(--color-primary)]" />
            AuthMasterclass
          </div>
          <div>Built with FastAPI + React + 165 tests</div>
        </div>
      </footer>
    </div>
  )
}
