import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// mode: 'system' | 'light' | 'dark'. New visitors follow their device setting;
// once they pick light/dark it is remembered. `theme` is always the resolved value.
const ThemeCtx = createContext(null)
const KEY = 'cp-theme'
const mql = () => window.matchMedia?.('(prefers-color-scheme: dark)')

function readMode() {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readMode)
  const [systemDark, setSystemDark] = useState(() => !!mql()?.matches)

  useEffect(() => {
    const m = mql()
    if (!m) return
    const on = (e) => setSystemDark(e.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  const theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  const setMode = useCallback((m) => {
    if (m === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, m)
    setModeState(m)
  }, [])

  const toggleTheme = useCallback(() => setMode(theme === 'dark' ? 'light' : 'dark'), [theme, setMode])

  return (
    <ThemeCtx.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
