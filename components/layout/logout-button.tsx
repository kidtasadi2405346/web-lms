'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={handleLogout}
      disabled={loading}
      aria-label="Keluar"
      className={iconOnly ? undefined : 'w-full justify-start'}
    >
      <LogOut className="h-4 w-4" />
      {iconOnly ? null : 'Keluar'}
    </Button>
  )
}
