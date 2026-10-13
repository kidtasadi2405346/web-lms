'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { isValidIdentity, toPseudoEmail } from '@/lib/identity'
import { ROLE_HOME, type Role } from '@/lib/roles'

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isValidIdentity(identity)) {
      setError('NIS/NIP hanya boleh berisi huruf dan angka (3–30 karakter).')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: toPseudoEmail(identity),
      password,
    })

    if (signInError || !data.user) {
      setError('NIS/NIP atau password salah.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    if (!profile) {
      await supabase.auth.signOut()
      setError('Akun Anda belum memiliki profil. Hubungi admin sekolah.')
      setLoading(false)
      return
    }

    router.replace(ROLE_HOME[profile.role as Role])
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Gunakan NIS (siswa) atau NIP (guru) dan password Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="identity">NIS / NIP</Label>
            <Input
              id="identity"
              inputMode="numeric"
              autoComplete="username"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Siswa baru?{' '}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Daftar dengan kode kelas
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">Lupa password? Hubungi admin sekolah.</p>
      </CardContent>
    </Card>
  )
}
