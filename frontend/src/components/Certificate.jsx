import { useState, useRef } from 'react'
import { Award, Download, Share2, CheckCircle2 } from 'lucide-react'

export default function Certificate({ completedCount, total = 15 }) {
  const canvasRef = useRef(null)
  const [name, setName] = useState('')
  const isUnlocked = completedCount >= total

  const generateCertificate = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = 800, h = 560
    canvas.width = w
    canvas.height = h

    // Background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)

    // Border
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 3
    ctx.strokeRect(20, 20, w - 40, h - 40)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.strokeRect(30, 30, w - 60, h - 60)

    // Corner decorations
    const drawCorner = (x, y) => {
      ctx.fillStyle = '#4f46e5'
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    drawCorner(30, 30); drawCorner(w - 30, 30); drawCorner(30, h - 30); drawCorner(w - 30, h - 30)

    // Header
    ctx.fillStyle = '#4f46e5'
    ctx.font = '14px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('AUTHENTICATION MASTERCLASS', w / 2, 80)

    // Title
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 32px Inter, sans-serif'
    ctx.fillText('Certificate of Completion', w / 2, 130)

    // Divider
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w / 2 - 100, 150)
    ctx.lineTo(w / 2 + 100, 150)
    ctx.stroke()

    // "This certifies that"
    ctx.fillStyle = '#64748b'
    ctx.font = '14px Inter, sans-serif'
    ctx.fillText('This certifies that', w / 2, 200)

    // Name
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 28px Inter, sans-serif'
    ctx.fillText(name || 'Your Name', w / 2, 245)

    // Underline
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2 - 150, 255)
    ctx.lineTo(w / 2 + 150, 255)
    ctx.stroke()

    // Description
    ctx.fillStyle = '#334155'
    ctx.font = '14px Inter, sans-serif'
    ctx.fillText('has successfully completed all 15 chapters and 3 projects of the', w / 2, 300)
    ctx.font = 'bold 16px Inter, sans-serif'
    ctx.fillStyle = '#4f46e5'
    ctx.fillText('Authentication Masterclass: From Passwords to AI Agents', w / 2, 330)

    // Stats
    ctx.fillStyle = '#64748b'
    ctx.font = '13px Inter, sans-serif'
    ctx.fillText('15 Chapters  •  3 Projects  •  165 Tests  •  RS256 + RBAC + ReAct Agent', w / 2, 375)

    // Date
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText(`Completed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, w / 2, 420)

    // Shield icon (text approximation)
    ctx.fillStyle = '#4f46e5'
    ctx.font = '40px serif'
    ctx.fillText('🛡️', w / 2 - 20, 490)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px Inter, sans-serif'
    ctx.fillText('authmasterclass.dev', w / 2, 520)
  }

  const downloadCertificate = () => {
    generateCertificate()
    const link = document.createElement('a')
    link.download = `auth-masterclass-certificate-${name || 'completion'}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  if (!isUnlocked) {
    return (
      <div className="border border-[var(--color-border)] rounded-2xl p-8 text-center bg-[var(--color-surface)]">
        <Award size={40} className="mx-auto mb-4 text-[var(--color-text-dim)]" />
        <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Certificate of Completion</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Complete all 15 chapters to unlock your certificate.
        </p>
        <div className="w-48 h-2 bg-[var(--color-surface2)] rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${(completedCount / total) * 100}%` }} />
        </div>
        <p className="text-xs text-[var(--color-text-dim)] mt-2">{completedCount}/{total} chapters completed</p>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-bg)]">
      <div className="px-5 py-3 bg-[var(--color-surface2)] border-b border-[var(--color-border)] flex items-center gap-2">
        <Award size={18} className="text-[var(--color-primary)]" />
        <span className="text-sm font-semibold text-[var(--color-text)]">Your Certificate</span>
        <CheckCircle2 size={14} className="text-emerald-500 ml-auto" />
        <span className="text-xs text-emerald-600 font-medium">Unlocked!</span>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Your name (for the certificate)</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            placeholder="Enter your name" />
        </div>

        <button onClick={downloadCertificate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--color-primary-light)] transition-colors">
          <Download size={16} />
          Download Certificate (PNG)
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
