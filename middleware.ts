// middleware.ts - Updated with better error handling
import { updateSession } from '@/utils/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error('💥 Middleware fatal error:', error)
    
    // ✅ FIX: Graceful error handling - don't redirect on every error
    const currentPath = request.nextUrl.pathname
    const isPublicRoute = currentPath.startsWith('/login') || 
                         currentPath.startsWith('/auth') || 
                         currentPath.startsWith('/register')
    
    if (!isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('message', 'system_error')
      return NextResponse.redirect(url)
    }
    
    // For public routes, let them through even on error
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/login',
    '/clubs/:path*',
    '/files/:path*',
    '/dashboard/:path*',
    '/tasks/:path*',
    '/meetings/:path*',
    '/notifications/:path*',
    '/admin/:path*',
    '/permissions/:path*',
    '/settings/:path*'
  ]
}