

'use client'

import { useCallback, useEffect, useState } from 'react'
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
  user: User | null
  isLoading: boolean
  error: string | null
  initialized: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
    initialized: false // ✅ Initialize state
  })
  
  const supabase = createClient()

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
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
  }, [supabase])

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))
        
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!mounted) return
        
        if (authUser) {
          const userProfile = await fetchUserProfile(authUser)
          if (mounted) {
            setState({
              user: userProfile,
              isLoading: false,
              error: userProfile ? null : 'Profile not found',
              initialized: true // ✅ Mark as initialized
            })
          }
        } else {
          if (mounted) {
            setState({ 
              user: null, 
              isLoading: false, 
              error: null,
              initialized: true // ✅ Mark as initialized
            })
          }
        }
      } catch (error) {
        if (mounted) {
          setState({ 
            user: null, 
            isLoading: false, 
            error: 'Auth error',
            initialized: true 
          })
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_IN' && session?.user) {
        const userProfile = await fetchUserProfile(session.user)
        setState({
          user: userProfile,
          isLoading: false,
          error: userProfile ? null : 'Profile not found',
          initialized: true
        })
      } else if (event === 'SIGNED_OUT') {
        setState({ 
          user: null, 
          isLoading: false, 
          error: null,
          initialized: true
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ 
      user: null, 
      isLoading: false, 
      error: null,
      initialized: true
    })
  }, [supabase])

  // ✅ Simplified permission helpers
  return {
    ...state,
    isAuthenticated: !!state.user,
    isAdmin: state.user?.role === 'admin',
    isLeader: state.user?.role === 'club_leader',
    isMember: state.user?.role === 'member',
    signOut
  }
}