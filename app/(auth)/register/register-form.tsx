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

const MIN_PASSWORD = 6

function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'NIS ini sudah terdaftar. Silakan masuk, atau hubungi admin jika lupa password.'
  }
  if (m.includes('database error')) {
    // Trigger database menolak: kode kelas tidak valid.
    return 'Pendaftaran gagal. Periksa kembali Kode Kelas dari guru Anda.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.'
  }
  return 'Pendaftaran gagal. Periksa data Anda lalu coba lagi.'
}

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [nis, setNis] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (name.trim().length === 0) return setError('Nama wajib diisi.')
    if (!isValidIdentity(nis)) return setError('NIS hanya boleh berisi huruf dan angka (3–30 karakter).')
    if (password.length < MIN_PASSWORD) return setError(`Password minimal ${MIN_PASSWORD} karakter.`)
    if (referralCode.trim().length === 0) return setError('Kode kelas wajib diisi.')

    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: toPseudoEmail(nis),
      password,
      // Hanya nama dan kode kelas. Role & NIS tidak dipercaya dari sini: trigger menetapkan
      // role 'student' dan mengambil NIS dari email.
      options: { data: { name: name.trim(), referral_code: referralCode.trim().toUpperCase() } },
    })

    if (signUpError) {
      setError(friendlyError(signUpError.message))
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('Akun dibuat, tetapi belum bisa masuk otomatis. Hubungi admin (pengaturan Confirm email perlu dimatikan).')
      setLoading(false)
      return
    }

    router.replace('/student')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar siswa</CardTitle>
        <CardDescription>Minta kode kelas kepada guru Anda untuk bergabung.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nis">NIS</Label>
            <Input
              id="nis"
              inputMode="numeric"
              autoComplete="username"
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Minimal {MIN_PASSWORD} karakter.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referral">Kode kelas</Label>
            <Input
              id="referral"
              autoComplete="off"
              className="uppercase"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Memproses…' : 'Daftar'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
