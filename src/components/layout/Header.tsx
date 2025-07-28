'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Bell, LogOut, RefreshCw } from 'lucide-react'

export default function Header() {
  const { user, signOut } = useAuth()

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Yönetici'
      case 'club_leader': return 'Kulüp Lideri'
      case 'member': return 'Üye'
      default: return role
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500'
      case 'club_leader': return 'bg-blue-500'
      case 'member': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Community Platform</h1>
          {user && (
            <Badge className={`${getRoleBadgeColor(user.role)} text-white`}>
              {getRoleDisplayName(user.role)}
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-700"
            title="Sayfayı yenile"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden md:inline text-xs">Yenile</span>
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            title="Bildirimler"
          >
            <Bell className="h-5 w-5" />
            {/* Simple notification badge */}
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
            >
              0
            </Badge>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}