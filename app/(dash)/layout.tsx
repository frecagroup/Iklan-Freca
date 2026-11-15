import { AppShell } from '@/components/app-shell'
import { DashboardProvider } from '@/lib/data'

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <AppShell>{children}</AppShell>
    </DashboardProvider>
  )
}
