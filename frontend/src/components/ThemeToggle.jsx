import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className={`p-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors ${className}`}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun size={15} className="text-[var(--color-orange)]" /> : <Moon size={15} className="text-[var(--color-text-muted)]" />}
    </button>
  )
}
