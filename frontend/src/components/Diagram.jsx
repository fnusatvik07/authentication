export default function Diagram({ children, title }) {
  return (
    <div className="my-5 rounded-xl border border-[var(--color-border)] overflow-hidden">
      {title && (
        <div className="bg-[var(--color-surface2)] px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
          {title}
        </div>
      )}
      <div className="bg-[var(--color-surface)] p-5 font-mono text-[13px] leading-relaxed whitespace-pre text-[var(--color-text-secondary)] overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

export function FlowStep({ number, title, children, color = 'primary' }) {
  const colors = {
    primary: 'bg-[var(--color-primary-bg)] border-[var(--color-primary)] text-[var(--color-primary)]',
    green: 'bg-[var(--color-green-bg)] border-[var(--color-green)] text-[var(--color-green)]',
    orange: 'bg-[var(--color-orange-bg)] border-[var(--color-orange)] text-[var(--color-orange)]',
    purple: 'bg-[var(--color-purple-bg)] border-[var(--color-purple)] text-[var(--color-purple)]',
    red: 'bg-[var(--color-red-bg)] border-[var(--color-red)] text-[var(--color-red)]',
    blue: 'bg-[var(--color-blue-bg)] border-[var(--color-blue)] text-[var(--color-blue)]',
  }
  return (
    <div className="flex gap-4 items-start">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${colors[color]}`}>
        {number}
      </div>
      <div className="flex-1 pb-6">
        <h4 className="font-semibold text-[var(--color-text)] text-sm mb-1">{title}</h4>
        <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

export function InfoBox({ type = 'info', title, children }) {
  const styles = {
    info: 'bg-[var(--color-blue-bg)] border-[var(--color-blue)]/20 text-[var(--color-blue-text)]',
    warning: 'bg-[var(--color-orange-bg)] border-[var(--color-orange)]/20 text-[var(--color-orange-text)]',
    danger: 'bg-[var(--color-red-bg)] border-[var(--color-red)]/20 text-[var(--color-red-text)]',
    success: 'bg-[var(--color-green-bg)] border-[var(--color-green)]/20 text-[var(--color-green-text)]',
    tip: 'bg-[var(--color-purple-bg)] border-[var(--color-purple)]/20 text-[var(--color-purple-text)]',
  }
  const icons = { info: 'ℹ️', warning: '⚠️', danger: '🚫', success: '✅', tip: '💡' }

  return (
    <div className={`rounded-xl border p-4 my-4 ${styles[type]}`}>
      <div className="flex gap-2 items-start">
        <span className="text-base">{icons[type]}</span>
        <div>
          {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function ComparisonTable({ headers, rows }) {
  return (
    <div className="my-5 rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface2)]">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
