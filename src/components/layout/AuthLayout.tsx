import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { MainLayout } from './MainLayout'

interface AuthLayoutProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'club_leader' | 'member')[]
  requireAuth?: boolean
}

export default async function AuthLayout({
  children,
  allowedRoles,
  requireAuth = true
}: AuthLayoutProps) {
  if (!requireAuth) {
    return <MainLayout>{children}</MainLayout>
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    redirect('/login')
  }

  if (allowedRoles) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || !allowedRoles.includes(userData.role)) {
      redirect('/dashboard')
    }
  }

  return <MainLayout>{children}</MainLayout>
}