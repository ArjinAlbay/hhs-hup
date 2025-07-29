'use client'

import { useEffect, useState, memo } from 'react'
import { useAuth } from '@/store/auth-store'
import { useNotifications } from '@/store/notification-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  Users, 
  Calendar, 
  FileText,
  X,
  Settings,
  AlertCircle,
  Info,
  CheckCircle2
} from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// Notification icon mapper
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircle2
    case 'error': return AlertCircle
    case 'warning': return AlertCircle
    case 'info': 
    default: return Info
  }
}

// Notification color mapper
const getNotificationColor = (type: string) => {
  switch (type) {
    case 'success': return 'text-green-600 bg-green-50 border-green-200'
    case 'error': return 'text-red-600 bg-red-50 border-red-200'
    case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'info':
    default: return 'text-blue-600 bg-blue-50 border-blue-200'
  }
}

// Single notification item component
const NotificationItem = memo(({ 
  notification, 
  onMarkAsRead, 
  onDelete 
}: { 
  notification: any
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}) => {
  const Icon = getNotificationIcon(notification.type)
  const colorClass = getNotificationColor(notification.type)

  return (
    <Card className={cn(
      "border-l-4 transition-all duration-200 hover:shadow-md",
      colorClass,
      !notification.read && "shadow-sm"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Icon className={cn("h-5 w-5 mt-0.5", notification.type === 'success' ? 'text-green-600' : 
              notification.type === 'error' ? 'text-red-600' : 
              notification.type === 'warning' ? 'text-yellow-600' : 'text-blue-600')} />
            
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                !notification.read && "text-gray-900",
                notification.read && "text-gray-600"
              )}>
                {notification.title}
              </p>
              <p className={cn(
                "text-sm mt-1",
                !notification.read && "text-gray-700",
                notification.read && "text-gray-500"
              )}>
                {notification.message}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {format(new Date(notification.created_at), 'dd MMM HH:mm', { locale: tr })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(notification.id)}
                className="h-8 w-8 p-0 hover:bg-blue-100"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(notification.id)}
              className="h-8 w-8 p-0 hover:bg-red-100 text-gray-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
NotificationItem.displayName = 'NotificationItem'

// Notification dropdown for header
export const NotificationDropdown = memo(() => {
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user, fetchNotifications])

  const recentNotifications = notifications.slice(0, 5)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Bildirimler</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-6 text-xs"
            >
              Tümünü Okundu Yap
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Yükleniyor...
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Henüz bildirim yok
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                className="p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                    !notification.read ? "bg-blue-600" : "bg-transparent"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(notification.created_at), 'HH:mm', { locale: tr })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/notifications" className="w-full text-center text-sm">
            Tüm Bildirimleri Gör
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
NotificationDropdown.displayName = 'NotificationDropdown'

// Full notification center component
export default function OptimizedNotificationCenter() {
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user, fetchNotifications])

  const filteredNotifications = notifications.filter(notification => {
    switch (activeTab) {
      case 'unread':
        return !notification.read
      case 'read':
        return notification.read
      default:
        return true
    }
  })

  const unreadCount = notifications.filter(n => !n.read).length

  if (isLoading && notifications.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="w-5 h-5 bg-gray-200 rounded" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bildirimler</h1>
          <p className="text-gray-600">
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tüm bildirimler okundu'}
          </p>
        </div>
        
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline">
            <CheckCircle className="h-4 w-4 mr-2" />
            Tümünü Okundu Yap
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Tümü ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Okunmamış ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="read">
            Okunmuş ({notifications.length - unreadCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab === 'unread' ? 'Okunmamış bildirim yok' : 
                 activeTab === 'read' ? 'Okunmuş bildirim yok' : 'Henüz bildirim yok'}
              </h3>
              <p className="text-gray-500">
                Yeni bildirimler burada görünecek
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}