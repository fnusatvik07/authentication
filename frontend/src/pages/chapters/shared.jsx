export function H({ icon: Icon, title, badge, color = 'primary' }) {
  const c = {
    primary: 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]',
    green: 'bg-[var(--color-green-bg)] text-[var(--color-green-text)]',
    orange: 'bg-[var(--color-orange-bg)] text-[var(--color-orange-text)]',
    purple: 'bg-[var(--color-purple-bg)] text-[var(--color-purple-text)]',
    red: 'bg-[var(--color-red-bg)] text-[var(--color-red-text)]',
  }
  return (
    <div className="mb-8">
      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${c[color]} uppercase tracking-wider`}>{badge}</span>
      <h1 className="text-3xl font-bold mt-3 flex items-center gap-3">
        <Icon size={28} className="text-[var(--color-primary)]" />{title}
      </h1>
    </div>
  )
}

export function P({ children }) {
  return <p className="text-[var(--color-text-secondary)] leading-[1.8] text-[15px] mb-5">{children}</p>
}

export function Section({ title, children }) {
  return (
    <section className="mt-12 mb-8">
      <h2 className="text-xl font-bold mb-4 text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  )
}

export function Code({ children }) {
  return <code className="bg-[var(--color-surface2)] px-1.5 py-0.5 rounded text-[13px] font-mono text-[var(--color-primary-text)]">{children}</code>
}
