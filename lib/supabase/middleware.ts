import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Menyegarkan sesi Supabase dan memvalidasi user lewat getUser()
 * (memverifikasi token ke server Auth, bukan sekadar membaca cookie).
 * `ctx.response` dibungkus objek agar selalu menunjuk response terbaru
 * setelah cookie diperbarui.
 */
export async function updateSession(request: NextRequest) {
  const ctx = { response: NextResponse.next({ request }) }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          ctx.response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => ctx.response.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { ctx, supabase, user }
}
