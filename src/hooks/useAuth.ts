// src/hooks/useAuth.ts - HYBRID PERMISSION SYSTEM FIX
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'club_leader' | 'member'
  is_active: boolean
  email_confirmed: boolean
  permissions: Array<{ name: string }>
}

interface AuthState {
  user: User | null
  isLoading: boolean
  initialized: boolean
  error: string | null
}

// 🌍 Global state to prevent duplicate auth subscriptions
let globalAuthState: AuthState = {
  user: null,
  isLoading: true,
  initialized: false,
  error: null
}

let globalListeners = new Set<(state: AuthState) => void>()
let globalSubscription: any = null
let globalAuthInitialized = false

const notifyGlobalListeners = () => {
  globalListeners.forEach(listener => listener(globalAuthState))
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(globalAuthState)
  const supabase = createClient()

  // 📊 HYBRID: Fetch permissions from both JSON column AND relational tables
  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      // ✅ Step 1: Get basic user profile with JSON permissions
      const { data: profile, error } = await supabase
        .from('users')
        .select('id, email, name, role, is_active, email_verified, permissions')
        .eq('id', authUser.id)
        .single()

      if (error) {
        console.error('❌ Auth: Profile fetch error:', error)
        
        // ✅ Auto-create profile if user doesn't exist
        if (error.code === 'PGRST116') {
          console.log('🆕 Creating new user profile for:', authUser.email)
          
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
              role: 'member',
              is_active: true,
              permissions: []
            })
            .select('id, email, name, role, is_active, email_verified, permissions')
            .single()

          if (createError || !newProfile) {
            console.error('❌ Failed to create user profile:', createError)
            return null
          }
          
          // Use the newly created profile
          return {
            id: newProfile.id,
            email: newProfile.email,
            name: newProfile.name,
            role: newProfile.role,
            is_active: newProfile.is_active,
            email_confirmed: !!newProfile.email_verified,
            permissions: []
          }
        }
        return null
      }

      if (!profile) {
        console.error('❌ Auth: Profile is null')
        return null
      }

      // ✅ Step 2: Merge permissions from multiple sources
      let allPermissions: Array<{ name: string }> = []
      
      // Source 1: JSON column permissions (legacy)
      if (profile.permissions && Array.isArray(profile.permissions)) {
        const jsonPermissions = profile.permissions.map((p: any) => ({ 
          name: typeof p === 'string' ? p : p.name 
        }))
        allPermissions.push(...jsonPermissions)
      }
      
      // Source 2: Relational permissions (new system)
      try {
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select(`
            permissions:permission_id(name),
            expires_at,
            is_active
          `)
          .eq('user_id', authUser.id)
          .eq('is_active', true)

        if (userPermissions) {
          const relationalPermissions = userPermissions
            .filter((up: any) => {
              // Filter out expired permissions
              if (up.expires_at && new Date(up.expires_at) < new Date()) {
                return false
              }
              return up.permissions && up.permissions.name
            })
            .map((up: any) => ({ name: up.permissions.name }))
          
          allPermissions.push(...relationalPermissions)
        }
      } catch (permError) {
        console.warn('⚠️ Could not fetch relational permissions:', permError)
      }

      // Source 3: Role-based permissions (fallback)
      try {
        const { data: rolePermissions } = await supabase
          .from('role_permissions')
          .select(`
            permissions:permission_id(name)
          `)
          .eq('role', profile.role)

        if (rolePermissions) {
          const roleBasedPermissions = rolePermissions
            .filter((rp: any) => rp.permissions && rp.permissions.name)
            .map((rp: any) => ({ name: rp.permissions.name }))
          
          allPermissions.push(...roleBasedPermissions)
        }
      } catch (roleError) {
        console.warn('⚠️ Could not fetch role permissions:', roleError)
      }

      // ✅ Remove duplicates
      const uniquePermissions = allPermissions.filter((perm, index, self) =>
        index === self.findIndex(p => p.name === perm.name)
      )

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        is_active: profile.is_active,
        email_confirmed: !!profile.email_verified,
        permissions: uniquePermissions
      }
    } catch (error) {
      console.error('❌ Auth: Profile fetch failed:', error)
      return null
    }
  }, [supabase])

  // 🔄 Enhanced auth state handler
  const handleAuthStateChange = useCallback(async (event: string, session: any) => {
    console.log('🔄 Auth Event:', event, !!session)
    
    try {
      if (event === 'SIGNED_IN' && session?.user) {
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
        console.log('🚪 User signed out - clearing state')
        globalAuthState = {
          user: null,
          isLoading: false,
          initialized: true,
          error: null
        }
        notifyGlobalListeners()
        
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname
          if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register') && !currentPath.startsWith('/auth')) {
            window.location.replace('/login')
          }
        }
        
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed - updating profile')
        const userProfile = await fetchUserProfile(session.user)
        if (userProfile) {
          globalAuthState = {
            ...globalAuthState,
            user: userProfile,
            error: null
          }
          notifyGlobalListeners()
        }
        
      } else if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          const userProfile = await fetchUserProfile(session.user)
          globalAuthState = {
            user: userProfile,
            isLoading: false,
            initialized: true,
            error: userProfile ? null : 'Profile not found'
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

  // 🚀 Session initializer
  const initializeAuth = useCallback(async () => {
    if (globalAuthInitialized) return
    
    globalAuthInitialized = true
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('❌ Session initialization error:', error)
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
      console.error('💥 Auth initialization failed:', error)
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
    globalListeners.add(setState)
    
    if (!globalAuthInitialized) {
      initializeAuth()
      
      globalSubscription = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'INITIAL_SESSION' && globalAuthState.initialized) {
            return
          }
          handleAuthStateChange(event, session)
        }
      )
    }

    return () => {
      globalListeners.delete(setState)
      
      if (globalListeners.size === 0 && globalSubscription) {
        globalSubscription.data.subscription.unsubscribe()
        globalSubscription = null
        globalAuthInitialized = false
      }
    }
  }, [initializeAuth, handleAuthStateChange, supabase])

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