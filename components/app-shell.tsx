'use client'

// Layout mengikuti web Absensi Freca: sidebar navy di desktop, header + tab bawah di HP.
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Store, TrendingUp, LogOut, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { getSupabase } from '@/lib/supabase/client'
import { BRANDS, brandSlug } from '@/lib/metrics'
import { ThemeToggle } from './theme'
import { UpdateStatus, RefreshButton } from './update-status'
import { cn } from '@/lib/cn'

const nav = [
  { href: '/', label: 'Ringkasan', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { href: `/brand/${brandSlug(BRANDS[0])}`, label: 'Detail Brand', icon: Store, match: (p: string) => p.startsWith('/brand') },
  { href: '/tren', label: 'Tren', icon: TrendingUp, match: (p: string) => p.startsWith('/tren') },
]

function initialsOf(email?: string | null): string {
  if (!email) return 'F'
  return email.slice(0, 2).toUpperCase()
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const out = async () => {
    setUserMenu(false)
    await getSupabase().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const current = nav.find((n) => n.match(pathname)) ?? nav[0]

  const Sidebar = ({ mini = false }: { mini?: boolean }) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex h-20 flex-shrink-0 items-center border-b border-sidebar-border', mini ? 'justify-center px-2' : 'gap-3 px-5')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Freca Ads" className="h-9 w-9 flex-shrink-0 rounded-lg" draggable={false} />
        {!mini && (
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight text-sidebar-foreground">Freca Ads</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Dashboard Iklan</p>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((n) => {
          const Icon = n.icon
          const active = n.match(pathname)
          return (
            <div key={n.href}>
              <Link
                href={n.href}
                title={mini ? n.label : undefined}
                className={cn(
                  'flex items-center rounded-lg border-l-4 text-sm font-medium transition-colors',
                  mini ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-3',
                  active
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-transparent text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!mini && <span className="truncate">{n.label}</span>}
              </Link>
              {!mini && n.href.startsWith('/brand') && (
                <div className="ml-6 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                  {BRANDS.map((b) => {
                    const href = `/brand/${brandSlug(b)}`
                    const on = pathname === href
                    return (
                      <Link
                        key={b}
                        href={href}
                        className={cn(
                          'block rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                          on ? 'font-semibold text-primary' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
                        )}
                      >
                        {b}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      {!mini && (
        <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-foreground/50">Auto-refresh tiap 5 menit</div>
      )}
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-muted/40">
      <aside className={cn('relative hidden flex-shrink-0 transition-all duration-300 md:block', collapsed ? 'w-20' : 'w-64')}>
        <Sidebar mini={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
          className="absolute -right-3 top-7 z-30 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-sidebar text-sidebar-foreground/80 shadow-md transition-colors hover:text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header HP */}
        <header className="flex flex-shrink-0 items-center gap-2 border-b border-border/60 bg-card/80 px-4 pb-2.5 pt-[calc(0.75rem_+_env(safe-area-inset-top))] backdrop-blur md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logofreca.png" alt="Freca Group" className="h-7" draggable={false} />
          <div className="ml-auto flex items-center gap-1">
            <UpdateStatus compact />
            <RefreshButton />
            <ThemeToggle className="grid h-9 w-9 place-items-center text-lg leading-none" />
            <button
              onClick={out}
              aria-label="Keluar"
              className="grid h-9 w-9 place-items-center rounded-full text-foreground transition-colors hover:bg-destructive hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Header desktop */}
        <header className="hidden h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-8 md:flex">
          <h1 className="text-lg font-bold text-foreground">{current.label}</h1>
          <div className="flex items-center gap-3">
            <UpdateStatus />
            <RefreshButton withLabel />
            <ThemeToggle className="grid h-9 w-9 place-items-center rounded-full text-lg leading-none text-foreground transition-colors hover:bg-muted" />
            <div className="relative">
              <button
                onClick={() => setUserMenu((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-border/60 py-1 pl-1 pr-2 transition-colors hover:bg-muted"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{initialsOf(email)}</span>
                <span className="max-w-40 truncate text-sm font-medium text-foreground">{email ?? 'Akun'}</span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', userMenu && 'rotate-180')} />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
                    <button
                      onClick={out}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-destructive hover:text-white"
                    >
                      <LogOut className="h-4 w-4" /> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:p-8 md:pb-[calc(2rem_+_env(safe-area-inset-bottom))]">
            {children}
          </div>
        </main>

        {/* Tab bawah HP (gaya UserLayout Absensi) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-border bg-card/95 px-2 pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          {nav.map((n) => {
            const Icon = n.icon
            const active = n.match(pathname)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-medium transition-colors',
                  active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {n.label === 'Detail Brand' ? 'Brand' : n.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
