import { useState } from 'react'
import { Wrench, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'

export default function Exercise({ title, difficulty = 'easy', tasks, hints }) {
  const [expanded, setExpanded] = useState(false)
  const [completed, setCompleted] = useState({})
  const [showHints, setShowHints] = useState(false)

  const diffColors = {
    easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-orange-50 text-orange-700 border-orange-200',
    hard: 'bg-red-50 text-red-700 border-red-200',
  }

  const completedCount = Object.values(completed).filter(Boolean).length

  return (
    <div className="my-6 border border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-bg)]">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 bg-[var(--color-surface2)] border-b border-[var(--color-border)] flex items-center justify-between hover:bg-[var(--color-surface)] transition-colors">
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-[var(--color-orange)]" />
          <span className="text-sm font-semibold text-[var(--color-text)]">{title}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffColors[difficulty]}`}>{difficulty}</span>
          {completedCount === tasks.length && <CheckCircle2 size={14} className="text-emerald-500" />}
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && <span className="text-xs text-[var(--color-text-dim)]">{completedCount}/{tasks.length}</span>}
          {expanded ? <ChevronUp size={16} className="text-[var(--color-text-dim)]" /> : <ChevronDown size={16} className="text-[var(--color-text-dim)]" />}
        </div>
      </button>

      {expanded && (
        <div className="p-5">
          <div className="space-y-3 mb-4">
            {tasks.map((task, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={completed[i] || false}
                  onChange={e => setCompleted(prev => ({ ...prev, [i]: e.target.checked }))}
                  className="mt-0.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
                <span className={`text-sm leading-relaxed transition-all ${completed[i] ? 'text-[var(--color-text-dim)] line-through' : 'text-[var(--color-text-secondary)]'}`}>
                  {task}
                </span>
              </label>
            ))}
          </div>

          {hints && hints.length > 0 && (
            <div>
              <button onClick={() => setShowHints(!showHints)}
                className="text-xs text-[var(--color-primary)] hover:underline mb-2">
                {showHints ? 'Hide hints' : 'Need a hint?'}
              </button>
              {showHints && (
                <div className="bg-[var(--color-primary-bg)] border border-[var(--color-primary)]/10 rounded-lg p-3 space-y-1.5">
                  {hints.map((hint, i) => (
                    <p key={i} className="text-xs text-[var(--color-primary-text)]">💡 {hint}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
