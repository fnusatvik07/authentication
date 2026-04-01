import { useState } from 'react'
import { ThumbsUp, ThumbsDown, MessageSquare, Check } from 'lucide-react'

const STORAGE_KEY = 'auth-masterclass-feedback'

function loadFeedback() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveFeedback(slug, data) {
  const all = loadFeedback()
  all[slug] = { ...data, timestamp: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export default function ChapterFeedback({ slug }) {
  const existing = loadFeedback()[slug]
  const [voted, setVoted] = useState(existing?.vote || null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(!!existing)

  const handleVote = (vote) => {
    setVoted(vote)
    saveFeedback(slug, { vote })
    setSubmitted(false)
    if (vote === 'no') setShowComment(true)
  }

  const handleSubmit = () => {
    saveFeedback(slug, { vote: voted, comment })
    setSubmitted(true)
    setShowComment(false)
  }

  return (
    <div className="mt-10 p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)] font-medium">Was this chapter helpful?</p>
        <div className="flex items-center gap-2">
          {submitted && voted ? (
            <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={14} /> Thanks for the feedback!</span>
          ) : (
            <>
              <button onClick={() => handleVote('yes')}
                className={`p-2 rounded-lg border transition-all ${voted === 'yes' ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-emerald-300 hover:text-emerald-600'}`}>
                <ThumbsUp size={16} />
              </button>
              <button onClick={() => handleVote('no')}
                className={`p-2 rounded-lg border transition-all ${voted === 'no' ? 'border-red-300 bg-red-50 text-red-600' : 'border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-red-300 hover:text-red-600'}`}>
                <ThumbsDown size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {showComment && (
        <div className="mt-3 space-y-2">
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            className="w-full h-20 px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:border-[var(--color-primary)]"
            placeholder="What could be improved? (optional)" />
          <button onClick={handleSubmit}
            className="px-4 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--color-primary-light)] transition-colors flex items-center gap-1.5">
            <MessageSquare size={12} /> Submit
          </button>
        </div>
      )}

      {voted === 'yes' && !submitted && (
        <button onClick={() => { saveFeedback(slug, { vote: 'yes' }); setSubmitted(true) }}
          className="mt-2 text-xs text-[var(--color-primary)] hover:underline">
          Submit →
        </button>
      )}
    </div>
  )
}
