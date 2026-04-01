import { useState } from 'react'
import { CheckCircle2, XCircle, HelpCircle, ChevronDown } from 'lucide-react'

export default function Quiz({ questions }) {
  const [answers, setAnswers] = useState({})
  const [revealed, setRevealed] = useState({})

  const handleSelect = (qIdx, aIdx) => {
    if (revealed[qIdx]) return
    setAnswers(prev => ({ ...prev, [qIdx]: aIdx }))
  }

  const handleCheck = (qIdx) => {
    setRevealed(prev => ({ ...prev, [qIdx]: true }))
  }

  const total = questions.length
  const attempted = Object.keys(revealed).length
  const correct = Object.entries(revealed).filter(([qIdx]) =>
    answers[qIdx] === questions[qIdx].correct
  ).length

  return (
    <div className="my-8 border border-[var(--color-border)] rounded-2xl overflow-hidden bg-white">
      <div className="px-5 py-3 bg-[var(--color-surface2)] border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <HelpCircle size={16} className="text-[var(--color-primary)]" />
          Knowledge Check
        </div>
        {attempted > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            correct === attempted
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-orange-50 text-orange-600'
          }`}>
            {correct}/{attempted} correct
          </span>
        )}
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {questions.map((q, qIdx) => {
          const selected = answers[qIdx]
          const isRevealed = revealed[qIdx]
          const isCorrect = selected === q.correct

          return (
            <div key={qIdx} className="p-5">
              <p className="text-[var(--color-text)] font-medium text-sm mb-3">
                <span className="text-[var(--color-primary)] font-mono mr-2">Q{qIdx + 1}.</span>
                {q.question}
              </p>

              <div className="space-y-2 mb-3">
                {q.options.map((opt, aIdx) => {
                  let style = 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/30'
                  if (isRevealed) {
                    if (aIdx === q.correct) style = 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    else if (aIdx === selected) style = 'border-red-300 bg-red-50 text-red-800'
                    else style = 'border-[var(--color-border)] bg-[var(--color-surface)] opacity-50'
                  } else if (selected === aIdx) {
                    style = 'border-[var(--color-primary)] bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]'
                  }

                  return (
                    <button
                      key={aIdx}
                      onClick={() => handleSelect(qIdx, aIdx)}
                      disabled={isRevealed}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center gap-3 ${style}`}
                    >
                      <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ borderColor: 'currentColor' }}>
                        {isRevealed && aIdx === q.correct ? <CheckCircle2 size={14} /> :
                         isRevealed && aIdx === selected ? <XCircle size={14} /> :
                         String.fromCharCode(65 + aIdx)}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>

              {!isRevealed && selected !== undefined && (
                <button
                  onClick={() => handleCheck(qIdx)}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                  Check answer →
                </button>
              )}

              {isRevealed && q.explanation && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'}`}>
                  <span className="font-semibold">{isCorrect ? '✓ Correct!' : '✗ Not quite.'}</span>{' '}
                  {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {attempted === total && (
        <div className={`px-5 py-3 text-center text-sm font-medium ${
          correct === total ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
        }`}>
          {correct === total
            ? `Perfect score! ${total}/${total} - You've mastered this topic.`
            : `${correct}/${total} correct. Review the explanations above and try again.`
          }
        </div>
      )}
    </div>
  )
}
