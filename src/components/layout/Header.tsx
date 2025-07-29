'use client'

import { memo, useCallback } from 'react'
import { useAuth } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Settings, 
  LogOut, 
  User,
  ChevronDown
} from 'lucide-react'
// Import the notification dropdown
import { NotificationDropdown } from '@/components/notification/OptimizedNotificationCenter'


// User menu
const UserMenu = memo(() => {
  const { user, signOut } = useAuth()

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      // Redirect will happen automatically via auth listener
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }, [signOut])

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:block">
            {user.name}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Hesabım</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Profil</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Ayarlar</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Çıkış Yap</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
UserMenu.displayName = 'UserMenu'

const OptimizedHeader = memo(() => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left side - Title */}
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900">Community Platform</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-4">
        <NotificationDropdown />
        <UserMenu />
      </div>
    </header>
  )
})
OptimizedHeader.displayName = 'OptimizedHeader'

export default OptimizedHeader