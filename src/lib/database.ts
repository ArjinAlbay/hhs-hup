// 🔥 SORUN 4: database.ts'de fazla komplekslik - Simplify
// src/lib/database.ts - Simplified & Consistent

import { createClient } from '@/utils/supabase/client'

interface QueryOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class DatabaseService {
  private static getClient() {
    return createClient()
  }

  // ✅ Simplified clubs query - remove complex user context logic
  static async getClubs(options: QueryOptions = {}) {
    const supabase = this.getClient()
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
      data: transformedData || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      error
    }
  }

  // ✅ Simplified club detail
  static async getClub(id: string) {
    const supabase = this.getClient()

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

  // ✅ Simplified tasks - remove complex authorization
  static async getTasks(filters: {
    clubId?: string
    userId?: string
    status?: string
  } = {}, options: QueryOptions = {}) {
    const supabase = this.getClient()
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = options
    const offset = (page - 1) * limit

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:users!tasks_assigned_to_fkey(name),
        creator:users!tasks_assigned_by_fkey(name),
        club:clubs(name)
      `, { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    // Apply simple filters
    if (filters.clubId) {
      query = query.eq('club_id', filters.clubId)
    }
    if (filters.userId) {
      query = query.eq('assigned_to', filters.userId)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error, count } = await query
    
    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      error
    }
  }

  // ✅ Simplified meetings
  static async getMeetings(filters: {
    clubId?: string
  } = {}, options: QueryOptions = {}) {
    const supabase = this.getClient()
    const { page = 1, limit = 20 } = options
    const offset = (page - 1) * limit

    let query = supabase
      .from('meetings')
      .select(`
        *,
        organizer:users!meetings_organizer_id_fkey(name),
        club:clubs(name),
        participant_count:meeting_participants(count)
      `, { count: 'exact' })
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1)

    if (filters.clubId) {
      query = query.eq('club_id', filters.clubId)
    }

    const { data, error, count } = await query
    
    // Transform data to match interface
    const transformedData = data?.map(meeting => ({
      ...meeting,
      organizerName: meeting.organizer?.name || 'Unknown',
      participantCount: meeting.participant_count?.[0]?.count || 0
    }))
    
    return {
      data: transformedData || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      error
    }
  }

  // ✅ Keep simple CRUD operations
  static async createClub(club: any) {
    const supabase = this.getClient()
    return await supabase
      .from('clubs')
      .insert(club)
      .select()
      .single()
  }

  static async createTask(task: any) {
    const supabase = this.getClient()
    return await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
  }

  static async updateTask(id: string, updates: any) {
    const supabase = this.getClient()
    return await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  }
}