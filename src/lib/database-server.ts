// src/lib/database-server.ts - Server-side Database Service
import { createClient } from '@/utils/supabase/server'

interface QueryOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class ServerDatabaseService {
  private static async getClient() {
    return await createClient()
  }

  // Server-side clubs query
  static async getClubs(options: QueryOptions = {}) {
    const supabase = await this.getClient()
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = options
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('clubs')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const transformedData = data?.map(club => ({
      ...club,
      memberCount: 0 // Set to 0 for now
    }))

    return {
      data: {
        data: transformedData || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      },
      error
    }
  }

  // Server-side club detail
  static async getClub(id: string) {
    const supabase = await this.getClient()

    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (data) {
      return {
        data: {
          ...data,
          memberCount: 0,
          memberIds: []
        },
        error
      }
    }

    return { data, error }
  }
}