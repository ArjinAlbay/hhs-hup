'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'

interface AuthUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'club_leader' | 'member'
  clubId?: string
  isActive: boolean
  emailVerified: boolean
  permissions: Array<{
    name: string
    granted_at: string
    granted_by: string
  }>
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  initialized: boolean
  error: string | null
}


let globalAuthInitialized = false
let globalAuthState: AuthState = {
  user: null,
  isLoading: true,
  initialized: false,
  error: null
}
let globalListeners = new Set<(state: AuthState) => void>()
let globalSubscription: any = null

// 📢 Notify all components when global auth state changes
function notifyGlobalListeners() {
  globalListeners.forEach(listener => listener(globalAuthState))
}

const supabaseClient = createClient();

// 🔥 MINIMAL: Simple auth hook with cookie-only approach (Global Singleton)
export function useAuth() {
  // 🌍 Use global state instead of local state to prevent multiple initializations
  const [state, setState] = useState<AuthState>(globalAuthState)
  
  
  const supabase = supabaseClient

  // 🔍 User profile fetcher
  const fetchUserProfile = useCallback(async (authUser: User): Promise<AuthUser | null> => {
    try {
      // Fetch user basic profile
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('id, email, name, role, is_active')
        .eq('id', authUser.id)
        .single()

      if (error) throw error

      // For club leaders, fetch their club information
      let clubId: string | undefined = undefined;
      
      if (userProfile.role === 'club_leader') {
        // Club leaders should have a club where they are the leader
        const { data: leaderClub } = await supabase
          .from('clubs')
          .select('id')
          .eq('leader_id', authUser.id)
          .single()
        
        clubId = leaderClub?.id;
      } else if (userProfile.role === 'member') {
        // Members get their club from club_members table
        const { data: memberShip } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', authUser.id)
          .single()
        
        clubId = memberShip?.club_id;
      }

      return {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        role: userProfile.role,
        clubId: clubId,
        isActive: userProfile.is_active,
        emailVerified: !!authUser.email_confirmed_at,
        permissions: [] // Default empty permissions array since column doesn't exist
      }
    } catch (error) {
      console.error('❌ Auth: Profile fetch failed:', error)
      return null
    }
  }, [supabase])

  // 🔥 MINIMAL: Auth state handler (cookie-based) - Global state updates
  const handleAuthStateChange = useCallback(async (event: string, session: any) => {
    try {
      if (event === 'SIGNED_IN' && session?.user) {
        // Update global state and notify all listeners
        globalAuthState = { ...globalAuthState, isLoading: true, error: null }
        notifyGlobalListeners()
        
        const userProfile = await fetchUserProfile(session.user)
        if (userProfile) {
          globalAuthState = {
            user: userProfile,
            isLoading: false,
            initialized: true,
            error: null
          }
        } else {
          globalAuthState = {
            user: null,
            isLoading: false,
            initialized: true,
            error: 'Profile could not be loaded'
          }
        }
        notifyGlobalListeners()
        
      } else if (event === 'SIGNED_OUT') {
        globalAuthState = {
          user: null,
          isLoading: false,
          initialized: true,
          error: null
        }
        notifyGlobalListeners()
        
        // 🔄 Redirect to login (cookie will be cleared automatically)
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname
          if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register') && !currentPath.startsWith('/auth')) {
            window.location.replace('/login')
          }
        }
        
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Do nothing - let the existing state persist
        
      } else if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user)
          if (userProfile) {
            globalAuthState = {
              user: userProfile,
              isLoading: false,
              initialized: true,
              error: null
            }
          } else {
            globalAuthState = {
              user: null,
              isLoading: false,
              initialized: true,
              error: null
            }
          }
        } else {
          globalAuthState = {
            user: null,
            isLoading: false,
            initialized: true,
            error: null
          }
        }
        notifyGlobalListeners()
      }
      
    } catch (error) {
      console.error('💥 Auth: State change error:', error)
      globalAuthState = {
        ...globalAuthState,
        error: 'Authentication error occurred',
        isLoading: false,
        initialized: true
      }
      notifyGlobalListeners()
    }
  }, [fetchUserProfile])

  // 🚀 Initialize auth (cookie-based session check) with global guard
  const initializeAuth = useCallback(async () => {
    // 🛡️ Guard: Only initialize if not already done globally
    if (globalAuthInitialized) return
    
    globalAuthInitialized = true
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        globalAuthState = {
          user: null,
          isLoading: false,
          initialized: true,
          error: 'Session initialization failed'
        }
        notifyGlobalListeners()
        return
      }

      await handleAuthStateChange('INITIAL_SESSION', session)
      
    } catch (error) {
      globalAuthState = {
        user: null,
        isLoading: false,
        initialized: true,
        error: 'Auth initialization failed'
      }
      notifyGlobalListeners()
    }
  }, [supabase, handleAuthStateChange])

 useEffect(() => {
  // 🌍 Add this component's setState to global listeners
  globalListeners.add(setState)
  
  // 🚀 Only initialize auth if not already done globally
  if (!globalAuthInitialized) {
    initializeAuth()
    
    // Create global subscription only once
    globalSubscription = supabase.auth.onAuthStateChange(
      (event, session) => {
        handleAuthStateChange(event, session)
      }
    )
  }

  // Cleanup function - remove this component from listeners
  return () => {
    globalListeners.delete(setState)
    
    // Only cleanup subscription if no more listeners
    if (globalListeners.size === 0 && globalSubscription) {
      globalSubscription.data.subscription.unsubscribe()
      globalSubscription = null
      globalAuthInitialized = false // Reset for next time
    }
  }
}, []) 

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
 
    } catch (error) {
      console.error('❌ Auth: Logout error:', error)
    }
  }, [supabase])


  const refreshProfile = useCallback(async () => {
    if (!globalAuthState.user) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const freshProfile = await fetchUserProfile(session.user)
        if (freshProfile) {
          globalAuthState = { ...globalAuthState, user: freshProfile }
          notifyGlobalListeners()
        }
      }
    } catch (error) {
      console.error('❌ Auth: Profile refresh failed:', error)
    }
  }, [fetchUserProfile, supabase])


  const computedValues = useMemo(() => ({
    isAuthenticated: !!state.user,
    isAdmin: state.user?.role === 'admin',
    isLeader: state.user?.role === 'club_leader',
    isMember: state.user?.role === 'member',
    hasPermission: (permission: string) => {
      return state.user?.permissions?.some(p => p.name === permission) || false
    }
  }), [state.user])

  return {
    ...state,
    ...computedValues,
    logout,
    refreshProfile
  }
}
