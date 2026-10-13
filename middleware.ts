import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { ROLE_HOME, roleFromPath, type Role } from '@/lib/roles'

const AUTH_PAGES = ['/login', '/register']

type Ctx = { response: NextResponse }

function redirectTo(request: NextRequest, ctx: Ctx, path: string) {
  const url = request.nextUrl.clone()
  const [pathname = '/', query] = path.split('?')
  url.pathname = pathname
  url.search = query ? `?${query}` : ''
  const res = NextResponse.redirect(url)
  // Bawa cookie sesi yang baru disegarkan/dihapus ke response redirect.
  ctx.response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
  return res
}

export async function middleware(request: NextRequest) {
  const { ctx, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const requiredRole = roleFromPath(pathname)
  const isAuthPage = AUTH_PAGES.includes(pathname)
  if (!requiredRole && !isAuthPage) return ctx.response

  // Belum login: rute role dialihkan ke /login, halaman login/register dibiarkan.
  if (!user) return requiredRole ? redirectTo(request, ctx, '/login') : ctx.response

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return isAuthPage ? ctx.response : redirectTo(request, ctx, '/login?error=server')

  // Akun ada di Auth tetapi tidak punya profil: tidak boleh masuk ke mana pun.
  if (!profile) {
    await supabase.auth.signOut()
    return redirectTo(request, ctx, '/login?error=no_profile')
  }

  const role = profile.role as Role
  if (isAuthPage || role !== requiredRole) return redirectTo(request, ctx, ROLE_HOME[role])

  return ctx.response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
