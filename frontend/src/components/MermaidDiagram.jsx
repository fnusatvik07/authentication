import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#eef2ff',
    primaryTextColor: '#3730a3',
    primaryBorderColor: '#6366f1',
    secondaryColor: '#ecfdf5',
    secondaryTextColor: '#065f46',
    secondaryBorderColor: '#059669',
    tertiaryColor: '#fffbeb',
    tertiaryTextColor: '#92400e',
    tertiaryBorderColor: '#d97706',
    lineColor: '#94a3b8',
    textColor: '#334155',
    mainBkg: '#eef2ff',
    nodeBorder: '#6366f1',
    clusterBkg: '#f8fafc',
    clusterBorder: '#e2e8f0',
    edgeLabelBackground: '#ffffff',
    fontSize: '14px',
  },
  flowchart: { curve: 'basis', padding: 16 },
  sequence: { actorMargin: 80, messageFontSize: 13 },
})

let counter = 0

export default function MermaidDiagram({ chart, title }) {
  const ref = useRef(null)
  const [svg, setSvg] = useState('')
  const idRef = useRef(`mermaid-${++counter}`)

  useEffect(() => {
    const render = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, chart)
        setSvg(svg)
      } catch (e) {
        console.error('Mermaid render error:', e)
        setSvg(`<pre style="color:#dc2626;padding:12px">${e.message}</pre>`)
      }
    }
    render()
  }, [chart])

  return (
    <div className="my-5 rounded-xl border border-[var(--color-border)] overflow-hidden bg-white">
      {title && (
        <div className="bg-[var(--color-surface2)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-border)] flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          {title}
        </div>
      )}
      <div
        ref={ref}
        className="p-6 flex justify-center overflow-x-auto [&>svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
