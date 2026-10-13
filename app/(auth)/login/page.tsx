import { LoginForm } from '@/app/(auth)/login/login-form'

const ERROR_MESSAGES: Record<string, string> = {
  no_profile: 'Akun Anda belum memiliki profil. Hubungi admin sekolah.',
  server: 'Terjadi gangguan saat memeriksa akun. Coba masuk lagi.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <LoginForm initialError={error ? ERROR_MESSAGES[error] : undefined} />
}
