import type { ReactNode } from 'react'
import Link from 'next/link'
import { GraduationCap, Settings } from 'lucide-react'
import { LogoutButton } from '@/components/layout/logout-button'
import { SidebarNav, type StudentSubjectNav } from '@/components/layout/sidebar-nav'
import {
  ProfilePreferencesProvider,
  SettingsLink,
} from '@/components/layout/profile-preferences'
import { UserAvatar } from '@/components/layout/user-avatar'
import { avatarPublicUrl } from '@/lib/avatar'
import { ROLE_HOME, ROLE_LABEL } from '@/lib/roles'
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
    <ProfilePreferencesProvider profile={profile}>
      <div className="flex h-screen overflow-hidden bg-background">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-card/50 backdrop-blur-md md:flex h-full overflow-y-auto custom-scrollbar flex-shrink-0">
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 px-5 font-bold tracking-tight text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold leading-none">EduSpace</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                Learning Platform
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <SidebarNav role={profile.role} studentSubjects={studentSubjects} />
          </div>

          <div className="mt-auto shrink-0 border-t border-border/70 p-3.5 bg-muted/20">
            <div className="mb-2.5 rounded-xl border border-border/60 bg-card/80 p-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  src={avatarPublicUrl(profile.avatar_url)}
                  name={profile.name}
                  className="h-9 w-9 shrink-0 border border-border/60 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{profile.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {ROLE_LABEL[profile.role]} · {profile.identity_number}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <SettingsLink role={profile.role} />
              <LogoutButton />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
          <header className="shrink-0 z-30 flex min-h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2.5 font-bold md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold">EduSpace</span>
            </div>

            {/* Desktop header status / context */}
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Pembelajaran Terkoneksi</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`${ROLE_HOME[profile.role]}/settings`}
                aria-label="Pengaturan Akun"
                className="md:hidden flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/80 hover:text-foreground transition-colors"
              >
                <Settings className="h-5 w-5" />
              </Link>
              <div className="md:hidden">
                <LogoutButton iconOnly />
              </div>
            </div>
          </header>

          <main className="flex-1 h-full overflow-y-auto custom-scrollbar relative p-5 md:p-8">
            <div className="max-w-7xl w-full mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </ProfilePreferencesProvider>
  )
}
