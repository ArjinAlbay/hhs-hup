// 🔥 SORUN 2: api-middleware.ts çok karmaşık - Simplify
// src/lib/api-middleware.ts - Simplified Version

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'admin' | 'club_leader' | 'member'
  clubId?: string
}

// ✅ Simplified authentication
export async function authenticateRequest(request: NextRequest): Promise<{
  user: AuthenticatedUser | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null, error: 'Authentication required' }
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, is_active, name')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || !userProfile.is_active) {
      return { user: null, error: 'User profile not found' }
    }

    // ✅ Simple clubId logic
    let clubId: string | undefined
    if (userProfile.role === 'club_leader') {
      const { data: leaderClub } = await supabase
        .from('clubs')
        .select('id')
        .eq('leader_id', user.id)
        .single()
      clubId = leaderClub?.id
    }

    return {
      user: {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        clubId: clubId
      },
      error: null
    }
  } catch (error) {
    return { user: null, error: 'Authentication failed' }
  }
}

// ✅ Simplified authorization
export function authorizeUser(
  user: AuthenticatedUser,
  allowedRoles?: ('admin' | 'club_leader' | 'member')[],
  clubId?: string
): { authorized: boolean; error?: string } {
  
  // Admin always authorized
  if (user.role === 'admin') {
    return { authorized: true }
  }

  // Check role permissions
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { authorized: false, error: 'Insufficient permissions' }
  }

  // Check club access for club leaders
  if (clubId && user.role === 'club_leader' && user.clubId !== clubId) {
    return { authorized: false, error: 'Club access denied' }
  }

  return { authorized: true }
}

// ✅ Simplified API Response helper
export class ApiResponse {
  static success<T>(data: T, message?: string, pagination?: any) {
    return NextResponse.json({
      success: true,
      data,
      message,
      pagination
    })
  }

  static error(message: string, status = 500) {
    return NextResponse.json({
      success: false,
      error: message
    }, { status })
  }

  static unauthorized(message = 'Unauthorized') {
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 401 })
  }

  static forbidden(message = 'Forbidden') {
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 403 })
  }

  static badRequest(message: string) {
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 400 })
  }
}

// ✅ Simplified withAuth middleware
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: any[]) => Promise<NextResponse>,
  options: {
    allowedRoles?: ('admin' | 'club_leader' | 'member')[]
  } = {}
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      const { user, error } = await authenticateRequest(request)
      
      if (!user || error) {
        return ApiResponse.unauthorized(error ?? 'Authentication required')
      }

      if (options.allowedRoles) {
        const { authorized, error: authError } = authorizeUser(user, options.allowedRoles)
        if (!authorized) {
          return ApiResponse.forbidden(authError)
        }
      }

      return await handler(request, user, ...args)
    } catch (error) {
      console.error('API middleware error:', error)
      return ApiResponse.error('Internal server error')
    }
  }
}

// ✅ Simple pagination helper
export function parsePagination(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  return {
    page: parseInt(searchParams.get('page') || '1'),
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  }
}