import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import 'katex/dist/katex.min.css'

export const metadata: Metadata = {
  title: 'EduSpace',
  description: 'Pembelajaran daring untuk sekolah',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
