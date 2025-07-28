import { NextRequest } from 'next/server'
import { DatabaseService } from '@/lib/database'
import { withAuth, ApiResponse, parsePagination } from '@/lib/api-middleware'

export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { page, limit } = parsePagination(request)
    const { searchParams } = new URL(request.url)
    
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

    const result = await DatabaseService.getClubs(user.id, {
      page,
      limit,
      sortBy,
      sortOrder
    })
    
    if (result.error) {
      return ApiResponse.error('Kulüpler yüklenemedi')
    }

    return ApiResponse.success(result.data, undefined, result.pagination)
  } catch (error) {
    return ApiResponse.error('Kulüpler yüklenemedi')
  }
})

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { name, description, type = 'social' } = body

    if (!name || !description) {
      return ApiResponse.badRequest('Kulüp adı ve açıklama gerekli')
    }

    const allowedTypes = ['social', 'education', 'project']
    if (!allowedTypes.includes(type)) {
      return ApiResponse.badRequest('Geçersiz kulüp tipi')
    }

    const clubData = {
      name,
      description,
      type,
      leader_id: user.id,
      is_active: true,
      settings: {
        maxFileSize: 10485760,
        requireApproval: false,
        allowMemberTasks: true
      }
    }

    const { data, error } = await DatabaseService.createClub(clubData)
    
    if (error) {
      return ApiResponse.error('Kulüp oluşturulamadı')
    }

    return ApiResponse.success(data, 'Kulüp başarıyla oluşturuldu')
  } catch (error) {
    return ApiResponse.error('Kulüp oluşturulamadı')
  }
}, { allowedRoles: ['admin', 'club_leader'] })