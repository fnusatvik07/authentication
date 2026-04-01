import { useState, useMemo } from 'react'
import { Key, AlertTriangle, CheckCircle2, Clock, Copy, Check } from 'lucide-react'

const SAMPLE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGljZSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTczNTY4OTYwMCwiaWF0IjoxNzM1Njg2MDAwLCJqdGkiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

function base64UrlDecode(str) {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - str.length % 4) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function formatTimestamp(ts) {
  if (!ts || typeof ts !== 'number') return null
  const d = new Date(ts * 1000)
  const now = new Date()
  const expired = d < now
  return { date: d.toLocaleString(), expired, relative: expired ? 'Expired' : `Expires in ${Math.round((d - now) / 60000)} min` }
}

export default function JWTDecoder({ className = '' }) {
  const [token, setToken] = useState(SAMPLE_TOKEN)
  const [copied, setCopied] = useState(false)

  const decoded = useMemo(() => {
    const parts = token.trim().split('.')
    if (parts.length !== 3) return null
    const header = base64UrlDecode(parts[0])
    const payload = base64UrlDecode(parts[1])
    if (!header || !payload) return null
    return { header, payload, signature: parts[2], parts }
  }, [token])

  const expInfo = decoded ? formatTimestamp(decoded.payload.exp) : null
  const iatInfo = decoded ? formatTimestamp(decoded.payload.iat) : null

  const handleCopy = () => { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className={`border border-[var(--color-border)] rounded-2xl overflow-hidden bg-white ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 bg-[var(--color-surface2)] border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <Key size={16} className="text-[var(--color-primary)]" />
          Interactive JWT Decoder
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setToken(SAMPLE_TOKEN)} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            Reset to sample
          </button>
          <button onClick={handleCopy} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Token input */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Paste a JWT token</label>
        <textarea
          value={token}
          onChange={e => setToken(e.target.value)}
          className="w-full h-20 px-3 py-2 text-[13px] font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:border-[var(--color-primary)] text-[var(--color-text)] leading-relaxed"
          placeholder="Paste your JWT here..."
          spellCheck={false}
        />
      </div>

      {!decoded ? (
        <div className="p-6 text-center text-sm text-[var(--color-text-muted)]">
          <AlertTriangle size={20} className="mx-auto mb-2 text-orange-400" />
          {token.trim() ? 'Invalid JWT format. Expected: header.payload.signature' : 'Paste a JWT above to decode it.'}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {/* Colored token parts */}
          <div className="p-4">
            <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Token Structure</label>
            <div className="font-mono text-[12px] leading-relaxed break-all">
              <span className="text-red-500 bg-red-50 px-0.5 rounded">{decoded.parts[0]}</span>
              <span className="text-[var(--color-text-dim)]">.</span>
              <span className="text-purple-600 bg-purple-50 px-0.5 rounded">{decoded.parts[1]}</span>
              <span className="text-[var(--color-text-dim)]">.</span>
              <span className="text-cyan-600 bg-cyan-50 px-0.5 rounded">{decoded.signature.slice(0, 20)}...</span>
            </div>
            <div className="flex gap-4 mt-2 text-[11px]">
              <span className="text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Header</span>
              <span className="text-purple-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Payload</span>
              <span className="text-cyan-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Signature</span>
            </div>
          </div>

          {/* Header */}
          <div className="p-4">
            <label className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-2 block">Header</label>
            <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 font-mono text-[13px]">
              {Object.entries(decoded.header).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-red-400">{`"${k}"`}:</span>
                  <span className="text-[var(--color-text)]">{`"${v}"`}</span>
                  <span className="text-[var(--color-text-dim)] text-[11px] ml-1 italic">
                    {k === 'alg' && (v === 'HS256' ? '← Symmetric (shared secret)' : v === 'RS256' ? '← Asymmetric (private/public key)' : '')}
                    {k === 'typ' && '← Token type'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payload */}
          <div className="p-4">
            <label className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider mb-2 block">Payload (Claims)</label>
            <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3 font-mono text-[13px] space-y-1">
              {Object.entries(decoded.payload).map(([k, v]) => {
                const isTime = k === 'exp' || k === 'iat'
                const timeInfo = isTime ? formatTimestamp(v) : null
                return (
                  <div key={k} className="flex flex-wrap gap-x-2 items-baseline">
                    <span className="text-purple-500">{`"${k}"`}:</span>
                    <span className="text-[var(--color-text)]">{JSON.stringify(v)}</span>
                    {k === 'sub' && <span className="text-[var(--color-text-dim)] text-[11px] italic">← Subject (user identity)</span>}
                    {k === 'role' && <span className="text-[var(--color-text-dim)] text-[11px] italic">← User's permission level</span>}
                    {k === 'jti' && <span className="text-[var(--color-text-dim)] text-[11px] italic">← Unique token ID (for blacklisting)</span>}
                    {k === 'type' && <span className="text-[var(--color-text-dim)] text-[11px] italic">← access or refresh</span>}
                    {timeInfo && (
                      <span className={`text-[11px] flex items-center gap-1 ${timeInfo.expired ? 'text-red-500' : 'text-emerald-600'}`}>
                        {timeInfo.expired ? <AlertTriangle size={11} /> : <Clock size={11} />}
                        {timeInfo.date} ({timeInfo.relative})
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Signature */}
          <div className="p-4">
            <label className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wider mb-2 block">Signature</label>
            <div className="bg-cyan-50/50 border border-cyan-100 rounded-lg p-3 text-[13px]">
              <p className="text-[var(--color-text-secondary)]">
                {decoded.header.alg === 'HS256' ? (
                  <>HMAC-SHA256(<span className="text-red-500">header</span> + "." + <span className="text-purple-600">payload</span>, <span className="font-semibold">SECRET_KEY</span>)</>
                ) : decoded.header.alg === 'RS256' ? (
                  <>RSA-SHA256(<span className="text-red-500">header</span> + "." + <span className="text-purple-600">payload</span>, <span className="font-semibold">PRIVATE_KEY</span>)</>
                ) : (
                  <>{decoded.header.alg}(<span className="text-red-500">header</span> + "." + <span className="text-purple-600">payload</span>, key)</>
                )}
              </p>
              <p className="text-[var(--color-text-dim)] text-[11px] mt-1">
                This signature proves the token hasn't been tampered with. It can only be created by someone with the secret/private key.
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="p-4 bg-[var(--color-surface)]">
            <div className="flex flex-wrap gap-3 text-[12px]">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                <Key size={12} /> {decoded.header.alg}
              </span>
              {decoded.payload.role && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 font-medium">
                  Role: {decoded.payload.role}
                </span>
              )}
              {expInfo && (
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${expInfo.expired ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {expInfo.expired ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {expInfo.relative}
                </span>
              )}
              {decoded.payload.jti && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600 font-medium">
                  JTI: {decoded.payload.jti.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
