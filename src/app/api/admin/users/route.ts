import { NextRequest } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { withAuth, ApiResponse, parsePagination } from '@/lib/api-middleware'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { page, limit } = parsePagination(request)
    
    const result = await DatabaseService.getUsers({
      page,
      limit,
      sortBy: 'name',
      sortOrder: 'asc'
    })
    
    if (result.error) {
      return ApiResponse.error('Kullanıcılar yüklenemedi')
    }

    return ApiResponse.success(result.data, undefined, result.pagination)
  } catch (error) {
    return ApiResponse.error('Kullanıcılar yüklenemedi')
  }
}, { requiredRole: 'admin' })