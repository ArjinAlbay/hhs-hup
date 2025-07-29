'use client'

import { useEffect, ReactNode } from 'react'
import { useAuthStore, initAuthListener } from '@/store/auth-store'

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { initAuth, initialized } = useAuthStore()

  useEffect(() => {
    // Initialize auth listener
    initAuthListener()
    
    // Initialize auth state if not already done
    if (!initialized) {
      initAuth()
    }
  }, [initAuth, initialized])

  return <>{children}</>
}