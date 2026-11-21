import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/toast'
import { DashboardProvider } from '@/lib/data'

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </DashboardProvider>
  )
}
