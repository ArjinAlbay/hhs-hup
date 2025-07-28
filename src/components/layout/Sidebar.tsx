'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { 
  Home, 
  Users, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Settings,
  Shield
} from 'lucide-react'

const NAVIGATION_CONFIG = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['admin', 'club_leader', 'member'] },
  { name: 'Kulüpler', href: '/clubs', icon: Users, roles: ['admin', 'club_leader', 'member'] },
  { name: 'Görevler', href: '/tasks', icon: CheckSquare, roles: ['admin', 'club_leader', 'member'] },
  { name: 'Toplantılar', href: '/meetings', icon: Calendar, roles: ['admin', 'club_leader', 'member'] },
  { name: 'Dosyalar', href: '/files', icon: FileText, roles: ['admin', 'club_leader', 'member'] },
  { name: 'Ayarlar', href: '/settings', icon: Settings, roles: ['admin', 'club_leader'] },
  { name: 'Admin Panel', href: '/admin', icon: Shield, roles: ['admin'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!user) return null

  const visibleNavItems = NAVIGATION_CONFIG.filter(item => 
    item.roles.includes(user.role)
  )

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Community</h2>
        <p className="text-sm text-gray-600">Platform</p>
      </div>

      {/* User Info */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">
              {user.role === 'admin' ? 'Yönetici' : 
               user.role === 'club_leader' ? 'Kulüp Lideri' : 'Üye'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-6 py-6">
        <nav className="space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </div>
      
      {/* Footer */}
      <div className="mt-auto p-6 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p>Community Platform v1.0</p>
          <p className="mt-1">© 2024 Tüm hakları saklıdır</p>
        </div>
      </div>
    </div>
  )
}