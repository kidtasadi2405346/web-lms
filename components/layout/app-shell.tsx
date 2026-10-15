import type { ReactNode } from 'react'
import { GraduationCap } from 'lucide-react'
import { LogoutButton } from '@/components/layout/logout-button'
import { SidebarNav, type StudentSubjectNav } from '@/components/layout/sidebar-nav'
import { ROLE_LABEL } from '@/lib/roles'
import type { Profile } from '@/lib/types'

export function AppShell({
  profile,
  studentSubjects,
  children,
}: {
  profile: Profile
  studentSubjects?: StudentSubjectNav[]
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/40 md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6 font-semibold">
          <GraduationCap className="h-5 w-5 text-primary" />
          EduSpace
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={profile.role} studentSubjects={studentSubjects} />
        </div>
        <div className="mt-auto border-t p-4">
          <p className="truncate text-sm font-medium">{profile.name}</p>
          <p className="mb-2 truncate text-xs text-muted-foreground">
            {ROLE_LABEL[profile.role]} · {profile.identity_number}
          </p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <div className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-5 w-5 text-primary" />
            EduSpace
          </div>
          <LogoutButton iconOnly />
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
