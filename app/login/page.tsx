'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { getSupabase } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const handleLogin = async () => {
    if (envMissing) {
      setError('Konfigurasi Supabase belum diisi (env Vercel).')
      return
    }
    if (!email || !password) {
      setError('Email dan password wajib diisi.')
      return
    }
    setError('')
    setLoading(true)
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error || !data.user) {
      setError('Email atau password salah.')
      setLoading(false)
      return
    }
    const next = params.get('next')
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_30px_rgba(0,46,78,.08)]">
      <h1 className="mb-1 text-xl font-bold text-foreground">Masuk</h1>
      <p className="mb-5 text-sm text-muted-foreground">Hanya untuk akun yang sudah terdaftar.</p>

      <div className="space-y-3">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="nama@frecagroup.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Password</span>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
      </div>

      {(error || envMissing) && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error || 'Konfigurasi Supabase belum diisi (env Vercel).'}
        </p>
      )}

      <Button onClick={handleLogin} loading={loading} size="lg" className="mt-5 w-full">
        {loading ? 'Memproses…' : 'Masuk'}
      </Button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-muted/40 px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="relative w-full max-w-sm animate-rise">
        <div className="mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logofreca.png" alt="Freca Group" className="h-12" draggable={false} />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Dashboard Iklan</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground">© Freca Group Indonesia · Freca Ads</p>
      </div>
    </div>
  )
}
