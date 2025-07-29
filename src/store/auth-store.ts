

'use client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createClient } from '@/utils/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'club_leader' | 'member'
  is_active: boolean
  clubId?: string
}

interface AuthState {
  // State
  user: User | null
  isLoading: boolean
  error: string | null
  initialized: boolean
  
  // Computed
  isAuthenticated: boolean
  isAdmin: boolean
  isLeader: boolean
  isMember: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setInitialized: (initialized: boolean) => void
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  initAuth: () => Promise<void>
}

const supabase = createClient()

const fetchUserProfile = async (authUser: SupabaseUser): Promise<User | null> => {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_active')
      .eq('id', authUser.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Create new user profile
        const { data: newProfile } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            role: 'member',
            is_active: true,
          })
          .select('id, email, name, role, is_active')
          .single()

        if (!newProfile) return null
        
        return {
          id: newProfile.id,
          email: newProfile.email,
          name: newProfile.name,
          role: newProfile.role,
          is_active: newProfile.is_active
        }
      }
      return null
    }

    if (!profile || !profile.is_active) return null

    let clubId: string | undefined
    if (profile.role === 'club_leader') {
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('leader_id', authUser.id)
        .single()
      clubId = club?.id
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      is_active: profile.is_active,
      clubId
    }
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isLoading: true,
      error: null,
      initialized: false,
      
      // Computed properties
      get isAuthenticated() {
        return !!get().user
      },
      get isAdmin() {
        return get().user?.role === 'admin'
      },
      get isLeader() {
        return get().user?.role === 'club_leader'
      },
      get isMember() {
        return get().user?.role === 'member'
      },

      // Actions
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setInitialized: (initialized) => set({ initialized }),

      signOut: async () => {
        try {
          await supabase.auth.signOut()
          set({ 
            user: null, 
            error: null,
            isLoading: false,
            initialized: true
          })
          // Clear all cached data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-storage')
            localStorage.removeItem('notifications-storage')
          }
          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        } catch (error) {
          console.error('Sign out error:', error)
        }
      },

      refreshUser: async () => {
        const { setLoading, setError, setUser } = get()
        
        try {
          setLoading(true)
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            const userProfile = await fetchUserProfile(authUser)
            setUser(userProfile)
            setError(userProfile ? null : 'Profile not found')
          } else {
            setUser(null)
            setError(null)
          }
        } catch (err) {
          setError('Auth error')
          setUser(null)
        } finally {
          setLoading(false)
        }
      },

      initAuth: async () => {
        const { setLoading, setError, setUser, setInitialized } = get()
        
        try {
          setLoading(true)
          const { data: { user: authUser } } = await supabase.auth.getUser()
          
          if (authUser) {
            const userProfile = await fetchUserProfile(authUser)
            setUser(userProfile)
            setError(userProfile ? null : 'Profile not found')
          } else {
            setUser(null)
            setError(null)
          }
        } catch (error) {
          setUser(null)
          setError('Auth error')
        } finally {
          setLoading(false)
          setInitialized(true)
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist user data, not loading states
      partialize: (state) => ({ 
        user: state.user,
        initialized: state.initialized 
      }),
    }
  )
)

// Initialize auth listener only once
let authListenerInitialized = false

export const initAuthListener = () => {
  if (authListenerInitialized) return


supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
    const { setUser, setError, setLoading, setInitialized } = useAuthStore.getState()
    
    if (event === 'SIGNED_IN' && session?.user) {
      const userProfile = await fetchUserProfile(session.user)
      setUser(userProfile)
      setError(userProfile ? null : 'Profile not found')
      setLoading(false)
      setInitialized(true)
    } else if (event === 'SIGNED_OUT') {
      setUser(null)
      setError(null)
      setLoading(false)
      setInitialized(true)
    }
  })

  authListenerInitialized = true
}

// Hook for easy access to auth state
export const useAuth = () => {
  const store = useAuthStore()
  
  return {
    user: store.user,
    isLoading: store.isLoading,
    error: store.error,
    initialized: store.initialized,
    isAuthenticated: store.isAuthenticated,
    isAdmin: store.isAdmin,
    isLeader: store.isLeader,
    isMember: store.isMember,
    signOut: store.signOut,
    refreshUser: store.refreshUser,
  }
}