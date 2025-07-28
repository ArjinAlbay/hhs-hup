'use client'

import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, Shield } from 'lucide-react'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'club_leader' | 'member'
  allowedRoles?: ('admin' | 'club_leader' | 'member')[]
  fallback?: React.ReactNode
}

export default function PermissionGuard({ 
  children, 
  requiredRole,
  allowedRoles,
  fallback 
}: PermissionGuardProps) {
  const { user, isLoading } = useAuth()

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

  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Giriş Gerekli</h3>
          <p className="text-gray-600">Bu içeriği görüntülemek için giriş yapın.</p>
        </div>
      </div>
    )
  }

  let hasAccess = false

  if (allowedRoles) {
    hasAccess = allowedRoles.includes(user.role)
  } else if (requiredRole) {
    hasAccess = user.role === requiredRole || user.role === 'admin'
  } else {
    hasAccess = true
  }

  if (!hasAccess) {
    return fallback || (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erişim Reddedildi</h3>
          <p className="text-gray-600">Bu içeriğe erişim yetkiniz bulunmuyor.</p>
          <div className="mt-3 text-sm text-gray-500">
            <p>Mevcut rol: <span className="font-medium">{getRoleName(user.role)}</span></p>
          </div>
        </div>
      </div>
    )
  }

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