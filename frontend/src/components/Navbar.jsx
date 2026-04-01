import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Shield, Menu, X } from 'lucide-react'
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
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-[var(--color-primary)] font-bold flex-shrink-0">
          <Shield size={18} />
          <span className="text-sm hidden sm:inline">AuthMasterclass</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
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

        {/* Mobile nav controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg border border-[var(--color-border)]">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 space-y-1">
          {navLinks.map(({ to, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + '/')
            return (
              <Link key={to} to={to} onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  active ? 'text-[var(--color-primary)] bg-[var(--color-primary-bg)]' : 'text-[var(--color-text-secondary)]'
                }`}>
                {label}
              </Link>
            )
          })}
          <a href="https://github.com/fnusatvik07/authentication" target="_blank" rel="noopener noreferrer"
            className="block px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)]">
            GitHub
          </a>
        </div>
      )}
    </nav>
  )
}
