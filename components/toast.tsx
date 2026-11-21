'use client'

// Toast — disalin dari web Absensi Freca (src/components/Toast.tsx); pesan error tampil lebih lama
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

type Tone = 'ok' | 'bad' | 'info'
type Item = { id: number; msg: string; tone: Tone }
type Ctx = { show: (msg: string, tone?: Tone) => void }

const ToastContext = createContext<Ctx>({ show: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const show = useCallback((msg: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setItems((p) => [...p, { id, msg, tone }])
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), tone === 'bad' ? 7000 : 3500)
  }, [])
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed left-1/2 top-4 z-[60] flex w-[92%] max-w-sm -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex animate-rise items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.tone === 'ok' ? 'bg-success' : t.tone === 'bad' ? 'bg-destructive' : 'bg-primary-dark'
            }`}
          >
            {t.tone === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : t.tone === 'bad' ? (
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <span className="break-words">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
