import { Link, useLocation } from 'react-router-dom'
import { Shield } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import SearchDialog from './SearchDialog'

const navLinks = [
  { to: '/learn', label: 'Learn' },
  { to: '/projects', label: 'Projects' },
  { to: '/playground', label: 'Playground' },
  { to: '/cheatsheet', label: 'Cheatsheet' },
]

export default function Navbar() {
  const location = useLocation()

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-[var(--color-primary)] font-bold">
          <Shield size={18} />
          <span className="text-sm">AuthMasterclass</span>
        </Link>
        <div className="flex items-center gap-0.5">
          {navLinks.map(({ to, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + '/')
            return (
              <Link key={to} to={to}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? 'text-[var(--color-primary)] bg-[var(--color-primary-bg)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'
                }`}>
                {label}
              </Link>
            )
          })}
          <a href="https://github.com/fnusatvik07/authentication" target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">
            GitHub
          </a>
          <div className="ml-1"><SearchDialog /></div>
          <ThemeToggle className="ml-0.5" />
        </div>
      </div>
    </nav>
  )
}
