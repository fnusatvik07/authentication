import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('auth-masterclass-theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('auth-masterclass-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = useCallback(() => setDark(prev => !prev), [])

  return { dark, toggle }
}
