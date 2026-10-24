import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { getCurrentProfile } from '@/lib/auth'
import './globals.css'
import 'katex/dist/katex.min.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'EduSpace',
  description: 'Pembelajaran daring untuk sekolah',
}

const themeBootstrap = `(function(){try{var t=localStorage.getItem('mini-lms-theme');if(t!=='light'&&t!=='dark'&&t!=='system')t=document.documentElement.dataset.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}})()`

export default async function RootLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentProfile()
  const theme = profile?.theme ?? 'system'

  return (
    <html lang="id" data-theme={theme} className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
