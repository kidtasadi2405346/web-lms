export type Role = 'student' | 'teacher' | 'admin'

export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  teacher: '/teacher',
  admin: '/admin',
}

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Siswa',
  teacher: 'Guru',
  admin: 'Admin',
}

/** Mengembalikan role yang berhak mengakses sebuah path, atau null jika path publik. */
export function roleFromPath(pathname: string): Role | null {
  for (const role of Object.keys(ROLE_HOME) as Role[]) {
    const home = ROLE_HOME[role]
    if (pathname === home || pathname.startsWith(`${home}/`)) return role
  }
  return null
}
