// src/lib/database-enhanced.ts - Enhanced Database Service with additional features
import { createClient } from '@/utils/supabase/server'
import { DatabaseService } from './database'

interface QueryOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, any>
}

interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  error?: any
}

export class EnhancedDatabaseService extends DatabaseService {
  private static async getServerClient() {
    return await createClient()
  }

  // Enhanced files operations
  static async getFiles(options: QueryOptions = {}): Promise<PaginationResult<any>> {
    const supabase = await this.getServerClient()
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = options
    const offset = (page - 1) * limit

    let query = supabase
      .from('files')
      .select(`
        *,
        uploaded_by_user:users!files_uploaded_by_fkey(name),
        folder:folders(name),
        club:clubs(name)
      `, { count: 'exact' })

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const transformedData = data?.map(file => ({
      ...file,
      uploader_name: file.uploaded_by_user?.name || 'Unknown',
      folder_name: file.folder?.name,
      club_name: file.club?.name
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

  // Enhanced folders operations
  static async getFolders(options: QueryOptions = {}): Promise<PaginationResult<any>> {
    const supabase = await this.getServerClient()
    const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc', filters = {} } = options
    const offset = (page - 1) * limit

    let query = supabase
      .from('folders')
      .select(`
        *,
        created_by_user:users!folders_created_by_fkey(name),
        club:clubs(name),
        parent_folder:folders!folders_parent_id_fkey(name)
      `, { count: 'exact' })

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const transformedData = data?.map(folder => ({
      ...folder,
      creator_name: folder.created_by_user?.name || 'Unknown',
      club_name: folder.club?.name,
      parent_name: folder.parent_folder?.name
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

  // Enhanced meetings operations  
  static async getMeetings(options: QueryOptions = {}): Promise<PaginationResult<any>> {
    const supabase = await this.getServerClient()
    const { page = 1, limit = 20, sortBy = 'start_time', sortOrder = 'desc', filters = {} } = options
    const offset = (page - 1) * limit

    let query = supabase
      .from('meetings')
      .select(`
        *,
        created_by_user:users!meetings_created_by_fkey(name),
        club:clubs(name)
      `, { count: 'exact' })

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const transformedData = data?.map(meeting => ({
      ...meeting,
      creator_name: meeting.created_by_user?.name || 'Unknown',
      club_name: meeting.club?.name
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

  // File creation with enhanced metadata
  static async createFile(fileData: {
    name: string
    path: string
    type: string
    size: number
    folder_id?: string
    club_id?: string
    uploaded_by: string
    metadata?: Record<string, any>
  }) {
    const supabase = await this.getServerClient()
    
    const { data, error } = await supabase
      .from('files')
      .insert([{
        ...fileData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    return { data, error }
  }

  // Folder creation
  static async createFolder(folderData: {
    name: string
    parent_id?: string
    club_id?: string
    created_by: string
  }) {
    const supabase = await this.getServerClient()
    
    const { data, error } = await supabase
      .from('folders')
      .insert([{
        ...folderData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    return { data, error }
  }

  // Delete file
  static async deleteFile(fileId: string) {
    const supabase = await this.getServerClient()
    
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)

    return { error }
  }

  // Delete folder
  static async deleteFolder(folderId: string) {
    const supabase = await this.getServerClient()
    
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)

    return { error }
  }
}