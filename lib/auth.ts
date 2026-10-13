import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROLE_HOME, type Role } from '@/lib/roles'
import type { Profile } from '@/lib/types'

/** Profil user yang sedang login (null jika belum login / belum punya profil). Di-cache per request. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, name, role, identity_number')
    .eq('id', user.id)
    .maybeSingle()

  return (data as Profile | null) ?? null
})

/** Dipakai di layout/halaman per role. Middleware adalah pagar pertama, ini pagar kedua. */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== role) redirect(ROLE_HOME[profile.role])
  return profile
}
