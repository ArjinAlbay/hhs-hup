'use client'

import { useAuth } from '@/hooks/useAuth'
import { Shield, AlertTriangle } from 'lucide-react'

interface SimpleRoleGuardProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'club_leader' | 'member')[]
  requiredRole?: 'admin' | 'club_leader' | 'member'
  fallback?: React.ReactNode
  showError?: boolean
}

export default function SimpleRoleGuard({
  children,
  allowedRoles,
  requiredRole,
  fallback,
  showError = true
}: SimpleRoleGuardProps) {
  const { user, isLoading } = useAuth()

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yetki kontrol ediliyor...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    if (fallback) return <>{fallback}</>
    
    return showError ? (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Giriş Gerekli</h3>
          <p className="text-gray-600">Bu içeriği görüntülemek için giriş yapın.</p>
        </div>
      </div>
    ) : null
  }

  // Check permissions
  let hasAccess = false

  if (requiredRole) {
    // Single role requirement (admin always has access)
    hasAccess = user.role === requiredRole || user.role === 'admin'
  } else if (allowedRoles) {
    // Multiple allowed roles
    hasAccess = allowedRoles.includes(user.role)
  } else {
    // No restrictions, just need to be authenticated
    hasAccess = true
  }

  // Access denied
  if (!hasAccess) {
    if (fallback) return <>{fallback}</>
    
    return showError ? (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erişim Reddedildi</h3>
          <p className="text-gray-600">Bu içeriğe erişim yetkiniz bulunmuyor.</p>
          <div className="mt-3 text-sm text-gray-500">
            <p>Mevcut rol: <span className="font-medium">{getRoleName(user.role)}</span></p>
            <p>
              Gerekli rol: <span className="font-medium">
                {requiredRole ? getRoleName(requiredRole) : allowedRoles?.map(getRoleName).join(', ')}
              </span>
            </p>
          </div>
        </div>
      </div>
    ) : null
  }

  // Access granted
  return <>{children}</>
}

function getRoleName(role: string): string {
  switch (role) {
    case 'admin': return 'Yönetici'
    case 'club_leader': return 'Kulüp Lideri'  
    case 'member': return 'Üye'
    default: return role
  }
}