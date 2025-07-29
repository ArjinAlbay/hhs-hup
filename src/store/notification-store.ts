'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  user_id: string
  read: boolean
  created_at: string
  metadata?: Record<string, any>
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  lastFetch: number | null
  
  // Actions
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchNotifications: () => Promise<void>
  clearAll: () => void
}

const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      lastFetch: null,

      setNotifications: (notifications) => {
        const unreadCount = notifications.filter(n => !n.read).length
        set({ 
          notifications, 
          unreadCount,
          lastFetch: Date.now()
        })
      },

      addNotification: (notification) => {
        const { notifications } = get()
        const newNotifications = [notification, ...notifications]
        const unreadCount = newNotifications.filter(n => !n.read).length
        set({ 
          notifications: newNotifications,
          unreadCount
        })
      },

      markAsRead: async (id) => {
        const { notifications } = get()
        
        try {
          const response = await fetch(`/api/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true })
          })

          if (response.ok) {
            const updatedNotifications = notifications.map(n =>
              n.id === id ? { ...n, read: true } : n
            )
            const unreadCount = updatedNotifications.filter(n => !n.read).length
            set({ 
              notifications: updatedNotifications,
              unreadCount
            })
          }
        } catch (error) {
          console.error('Failed to mark notification as read:', error)
        }
      },

      markAllAsRead: async () => {
        const { notifications } = get()
        
        try {
          const response = await fetch('/api/notifications/mark-all-read', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
          })

          if (response.ok) {
            const updatedNotifications = notifications.map(n => ({ ...n, read: true }))
            set({ 
              notifications: updatedNotifications,
              unreadCount: 0
            })
          }
        } catch (error) {
          console.error('Failed to mark all notifications as read:', error)
        }
      },

      deleteNotification: async (id) => {
        const { notifications } = get()
        
        try {
          const response = await fetch(`/api/notifications/${id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            const updatedNotifications = notifications.filter(n => n.id !== id)
            const unreadCount = updatedNotifications.filter(n => !n.read).length
            set({ 
              notifications: updatedNotifications,
              unreadCount
            })
          }
        } catch (error) {
          console.error('Failed to delete notification:', error)
        }
      },

      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),

      fetchNotifications: async () => {
        const { lastFetch, setLoading, setError, setNotifications } = get()
        
        // Check cache validity
        if (lastFetch && Date.now() - lastFetch < CACHE_DURATION) {
          return // Use cached data
        }

        setLoading(true)
        setError(null)

        try {
          const response = await fetch('/api/notifications')
          
          if (!response.ok) {
            throw new Error('Failed to fetch notifications')
          }

          const data = await response.json()
          setNotifications(data.notifications || [])
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
          setLoading(false)
        }
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
          isLoading: false,
          error: null,
          lastFetch: null
        })
      }
    }),
    {
      name: 'notifications-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        lastFetch: state.lastFetch
      }),
    }
  )
)

// Real-time notification hook
export const useNotifications = () => {
  const store = useNotificationStore()
  
  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    isLoading: store.isLoading,
    error: store.error,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    deleteNotification: store.deleteNotification,
    fetchNotifications: store.fetchNotifications,
    clearAll: store.clearAll
  }
}