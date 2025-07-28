import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/database'

type Tables = Database['public']['Tables']

interface QueryOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface UserContext {
  id: string
  role: 'admin' | 'club_leader' | 'member'
  clubId?: string
}

export class DatabaseService {
  private static getClient() {
    return createClient()
  }

  private static async getUserContext(userId: string): Promise<UserContext | null> {
    const supabase = this.getClient()
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (error || !user) return null

    let clubId: string | undefined
    
    if (user.role === 'club_leader') {
      const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('leader_id', userId)
        .single()
      clubId = club?.id
    } else if (user.role === 'member') {
      const { data: membership } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', userId)
        .single()
      clubId = membership?.club_id
    }

    return {
      id: user.id,
      role: user.role,
      clubId
    }
  }

  private static buildPaginatedQuery(
    tableName: string,
    selectFields: string,
    options: QueryOptions = {}
  ) {
    const supabase = this.getClient()
    const { page = 1, limit = 20, sortBy, sortOrder = 'desc' } = options
    const offset = (page - 1) * limit

    let query = supabase
      .from(tableName)
      .select(selectFields, { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    return query
  }

  static async getUsers(options: QueryOptions = {}) {
    const query = this.buildPaginatedQuery(
      'users',
      'id, name, email, role, is_active, created_at',
      options
    ).eq('is_active', true)

    const { data, error, count } = await query
    
    return {
      data: data || [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 20,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (options.limit || 20))
      },
      error
    }
  }

  static async getClubs(userId?: string, options: QueryOptions = {}) {
    const userContext = userId ? await this.getUserContext(userId) : null
    
    let query = this.buildPaginatedQuery(
      'clubs',
      `*,
       leader:users!clubs_leader_id_fkey(name),
       _count:club_members(count)`,
      options
    ).eq('is_active', true)

    if (userContext?.role === 'club_leader') {
      query = query.eq('leader_id', userId)
    }

    const { data, error, count } = await query
    
    const transformedData = data?.map(club => ({
      ...club,
      leaderName: club.leader?.name || 'Unknown',
      memberCount: club._count?.[0]?.count || 0
    }))

    return {
      data: transformedData || [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 20,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (options.limit || 20))
      },
      error
    }
  }

  static async getClub(id: string, userId?: string) {
    const userContext = userId ? await this.getUserContext(userId) : null
    const supabase = this.getClient()

    if (userContext?.role === 'club_leader' && userContext.clubId !== id) {
      return { data: null, error: { message: 'Access denied' } }
    }

    const { data, error } = await supabase
      .from('clubs')
      .select(`
        *,
        leader:users!clubs_leader_id_fkey(name),
        members:club_members(user_id, users(name))
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (data) {
      return {
        data: {
          ...data,
          leaderName: data.leader?.name || 'Unknown',
          memberCount: data.members?.length || 0,
          memberIds: data.members?.map((m: any) => m.user_id) || []
        },
        error
      }
    }

    return { data, error }
  }

  static async getTasks(filters: {
    clubId?: string
    userId?: string
    status?: string
  } = {}, options: QueryOptions = {}) {
    const userContext = filters.userId ? await this.getUserContext(filters.userId) : null
    
    let query = this.buildPaginatedQuery(
      'tasks',
      `*,
       assignee:users!tasks_assigned_to_fkey(name),
       creator:users!tasks_assigned_by_fkey(name),
       club:clubs(name)`,
      options
    )

    if (filters.clubId) {
      query = query.eq('club_id', filters.clubId)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (userContext) {
      if (userContext.role === 'member') {
        query = query.eq('assigned_to', userContext.id)
      } else if (userContext.role === 'club_leader' && userContext.clubId) {
        query = query.eq('club_id', userContext.clubId)
      }
    }

    const { data, error, count } = await query
    
    return {
      data: data || [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 20,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (options.limit || 20))
      },
      error
    }
  }

  static async getMeetings(filters: {
    clubId?: string
    userId?: string
  } = {}, options: QueryOptions = {}) {
    const userContext = filters.userId ? await this.getUserContext(filters.userId) : null
    
    let query = this.buildPaginatedQuery(
      'meetings',
      `*,
       organizer:users!meetings_organizer_id_fkey(name),
       club:clubs(name)`,
      { ...options, sortBy: 'start_time', sortOrder: 'asc' }
    )

    if (filters.clubId) {
      query = query.eq('club_id', filters.clubId)
    }

    if (userContext?.role === 'club_leader' && userContext.clubId) {
      query = query.eq('club_id', userContext.clubId)
    }

    const { data, error, count } = await query
    
    return {
      data: data || [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 20,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (options.limit || 20))
      },
      error
    }
  }

  static async getFiles(filters: {
    clubId?: string
    folderId?: string
    userId?: string
  } = {}, options: QueryOptions = {}) {
    const userContext = filters.userId ? await this.getUserContext(filters.userId) : null
    
    let query = this.buildPaginatedQuery(
      'files',
      `*,
       uploader:users!files_uploaded_by_fkey(name)`,
      options
    )

    if (filters.clubId) {
      query = query.eq('club_id', filters.clubId)
    }

    if (filters.folderId) {
      query = query.eq('folder_id', filters.folderId)
    }

    if (userContext?.role === 'club_leader' && userContext.clubId) {
      query = query.eq('club_id', userContext.clubId)
    }

    const { data, error, count } = await query
    
    return {
      data: data || [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 20,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / (options.limit || 20))
      },
      error
    }
  }

  static async createClub(club: Tables['clubs']['Insert']) {
    const supabase = this.getClient()
    return await supabase
      .from('clubs')
      .insert(club)
      .select()
      .single()
  }

  static async createTask(task: Tables['tasks']['Insert']) {
    const supabase = this.getClient()
    return await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
  }

  static async updateTask(id: string, updates: Tables['tasks']['Update']) {
    const supabase = this.getClient()
    return await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  }

  static async joinClub(clubId: string, userId: string) {
    const supabase = this.getClient()
    return await supabase
      .from('club_members')
      .insert({ club_id: clubId, user_id: userId })
      .select()
      .single()
  }
}