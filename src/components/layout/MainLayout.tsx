'use client'

import { memo, Suspense } from 'react'
import { useAuth } from '@/store/auth-store'
import AuthProvider from '@/components/providers/AuthProvider'
import OptimizedSidebar from './Sidebar'
import OptimizedHeader from './Header'

interface MainLayoutProps {
  children: React.ReactNode
}

// Optimized loading component
const LoadingSpinner = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
        </div>
      </div>
      <p className="text-gray-600 mt-4 text-sm font-medium">Yükleniyor...</p>
    </div>
  </div>
))
LoadingSpinner.displayName = 'LoadingSpinner'

// Content skeleton for better perceived performance
const ContentSkeleton = memo(() => (
  <div className="space-y-6 animate-pulse">
    <div className="space-y-2">
      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
      ))}
    </div>
  </div>
))
ContentSkeleton.displayName = 'ContentSkeleton'

// Auth wrapper with Zustand
const AuthenticatedLayout = memo(({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, initialized } = useAuth()

  // Show loading only during initial load
  if (!initialized || (isLoading && !user)) {
    return <LoadingSpinner />
  }

  // Redirect to login if not authenticated
  if (!user) {
    // In a real app, you'd use Next.js redirect here
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full"></div>
            </div>
          </div>
          <p className="text-gray-600 text-sm">Giriş sayfasına yönlendiriliyor...</p>
        </div>
      </div>
    )
  }

  // Render main layout
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar with suspense */}
      <Suspense fallback={
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="p-6 border-b border-gray-200 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div>
                <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          </div>
          <div className="flex-1 px-6 py-6 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      }>
        <OptimizedSidebar />
      </Suspense>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with suspense */}
        <Suspense fallback={
          <div className="h-16 bg-white border-b border-gray-200 animate-pulse flex items-center justify-between px-6">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="h-8 bg-gray-200 rounded w-24"></div>
          </div>
        }>
          <OptimizedHeader />
        </Suspense>
        
        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full px-6 py-6">
            <Suspense fallback={<ContentSkeleton />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
})
AuthenticatedLayout.displayName = 'AuthenticatedLayout'

// Main layout component
export function ZustandMainLayout({ children }: MainLayoutProps) {
  return (
    <AuthProvider>
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    </AuthProvider>
  )
}

// Export as default
export default ZustandMainLayout

// Export version without AuthProvider for cases where it's already provided at app level
export const MainLayoutContent = memo(({ children }: MainLayoutProps) => (
  <AuthenticatedLayout>
    {children}
  </AuthenticatedLayout>
))
MainLayoutContent.displayName = 'MainLayoutContent'