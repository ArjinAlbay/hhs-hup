// src/utils/supabase/middleware.ts - SESSION TIMEOUT FIX
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ✅ CRITICAL FIX: Enhanced session validation with refresh attempt
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  const currentPath = request.nextUrl.pathname
  const isLoginPage = currentPath.startsWith('/login')
  const isAuthPage = currentPath.startsWith('/auth')
  const isRegisterPage = currentPath.startsWith('/register')
  const isPublicRoute = isLoginPage || isAuthPage || isRegisterPage

  // ✅ FIX: Handle authentication errors (expired tokens, etc.)
  if (error && !isPublicRoute) {
    console.log('❌ Middleware: Auth error detected:', error.message)
    
    // Try to refresh the session
    try {
      const { data: { session }, error: refreshError } = await supabase.auth.getSession()
      
      if (refreshError || !session) {
        console.log('🔄 Session refresh failed, redirecting to login')
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('message', 'session_expired')
        return NextResponse.redirect(url)
      }
    } catch (refreshError) {
      console.error('💥 Session refresh error:', refreshError)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('message', 'auth_error')
      return NextResponse.redirect(url)
    }
  }

  // If user is authenticated and trying to access login page, redirect to dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!user && !isPublicRoute) {
    console.log('🚫 Unauthenticated access attempt to:', currentPath)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', currentPath) // Preserve intended destination
    return NextResponse.redirect(url)
  }

  // ✅ FIX: Add session validation headers for client-side detection
  if (user) {
    supabaseResponse.headers.set('x-user-authenticated', 'true')
    supabaseResponse.headers.set('x-user-id', user.id)
  } else {
    supabaseResponse.headers.set('x-user-authenticated', 'false')
  }

  return supabaseResponse
}
