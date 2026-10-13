import type { ReactNode } from 'react'
import { GraduationCap } from 'lucide-react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <GraduationCap className="h-6 w-6 text-primary" />
        Mini LMS
      </div>
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
