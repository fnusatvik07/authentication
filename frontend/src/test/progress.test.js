import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const store = {}
const localStorageMock = {
  getItem: vi.fn((key) => store[key] || null),
  setItem: vi.fn((key, value) => { store[key] = value }),
  removeItem: vi.fn((key) => { delete store[key] }),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Import after mocking
const { useProgress } = await import('../hooks/useProgress')
import { renderHook, act } from '@testing-library/react'

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.clearAllMocks()
})

describe('useProgress hook', () => {
  it('starts with zero completed', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.completedCount).toBe(0)
  })

  it('marks chapter as complete', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('jwt'))
    expect(result.current.isComplete('jwt')).toBe(true)
    expect(result.current.completedCount).toBe(1)
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('password-hashing'))
    expect(localStorageMock.setItem).toHaveBeenCalled()
    const saved = JSON.parse(store['auth-masterclass-progress'])
    expect(saved['password-hashing'].completed).toBe(true)
  })

  it('tracks multiple completions', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.markComplete('jwt')
      result.current.markComplete('rs256')
      result.current.markComplete('rbac')
    })
    expect(result.current.completedCount).toBe(3)
    expect(result.current.isComplete('jwt')).toBe(true)
    expect(result.current.isComplete('rs256')).toBe(true)
    expect(result.current.isComplete('rbac')).toBe(true)
    expect(result.current.isComplete('unknown')).toBe(false)
  })

  it('resets all progress', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.markComplete('jwt')
      result.current.markComplete('rs256')
    })
    expect(result.current.completedCount).toBe(2)
    act(() => result.current.reset())
    expect(result.current.completedCount).toBe(0)
    expect(result.current.isComplete('jwt')).toBe(false)
  })
})
