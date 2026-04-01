import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function CodeBlock({ code, language = 'python', title }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[var(--color-border)] my-4 bg-[var(--color-surface)]">
      {title && (
        <div className="px-4 py-2.5 text-xs text-[var(--color-text-muted)] font-mono flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface2)]">
          <span>{title}</span>
          <button onClick={handleCopy} className="hover:text-[var(--color-primary)] transition-colors p-1 rounded">
            {copied ? <Check size={14} className="text-[var(--color-green)]" /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        customStyle={{ margin: 0, padding: '12px', background: '#fafbfc', fontSize: '12px', lineHeight: '1.6', overflowX: 'auto' }}
        showLineNumbers
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
