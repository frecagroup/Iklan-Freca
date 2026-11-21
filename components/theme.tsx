'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

/** Dijalankan di <head> sebelum render supaya tidak berkedip saat mode gelap. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`

// Sumber kebenaran tema = class "dark" di <html>
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}
const getTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
const getServerTheme = (): Theme => 'light'

function setTheme(next: Theme) {
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem('theme', next)
  } catch {
    /* abaikan */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme)
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} className={className} aria-label="Ganti tema" title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
