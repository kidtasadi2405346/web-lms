import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { requireRole } from '@/lib/auth'

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole('teacher')
  return <AppShell profile={profile}>{children}</AppShell>
}
