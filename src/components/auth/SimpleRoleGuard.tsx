'use client'

import { useAuth } from '@/hooks/useAuth'

interface SimpleRoleGuardProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'club_leader' | 'member')[]
  requiredRole?: 'admin' | 'club_leader' | 'member'
  fallback?: React.ReactNode
}

export default function SimpleRoleGuard({
  children,
  allowedRoles,
  requiredRole,
  fallback
}: SimpleRoleGuardProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return fallback || <div>Access denied</div>
  }

  // Check required role
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return fallback || <div>Insufficient permissions</div>
  }

  // Check allowed roles
  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'admin') {
    return fallback || <div>Insufficient permissions</div>
  }

  return <>{children}</>
}