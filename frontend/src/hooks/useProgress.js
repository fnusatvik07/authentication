import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'auth-masterclass-progress'

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress)

  const markComplete = useCallback((slug) => {
    setProgress(prev => {
      const updated = { ...prev, [slug]: { completed: true, completedAt: new Date().toISOString() } }
      saveProgress(updated)
      return updated
    })
  }, [])

  const isComplete = useCallback((slug) => {
    return progress[slug]?.completed ?? false
  }, [progress])

  const completedCount = Object.values(progress).filter(v => v.completed).length

  const reset = useCallback(() => {
    setProgress({})
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { markComplete, isComplete, completedCount, reset, progress }
}
