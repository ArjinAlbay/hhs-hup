'use client'

import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface Club {
  id: string
  name: string
  description: string | null
  type: 'education' | 'social' | 'project'
  leader_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  memberCount?: number
}

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  club_id?: string
  assigned_by?: string
  assigned_to?: string
  due_date?: string
  files?: any[]
  feedback?: string
  grade?: number
  completed_at?: string
  created_at: string
  updated_at: string
}

interface Meeting {
  id: string
  title: string
  description?: string
  start_time: string
  end_time?: string
  location?: string
  club_id: string
  organizer_id?: string
  status?: string
  participants?: any[]
  created_at: string
  updated_at: string
}

interface FileItem {
  id: string
  name: string
  original_name: string
  file_url: string
  file_type: string
  mime_type: string
  file_size: number
  folder_id?: string
  club_id?: string
  uploaded_by?: string
  description?: string
  tags?: string[]
  is_public?: boolean
  download_count?: number
  version?: number
  cloudinary_public_id?: string
  created_at: string
  updated_at: string
}

interface Folder {
  id: string
  name: string
  parent_id?: string
  club_id?: string
  created_by?: string
  permissions?: any
  is_active?: boolean
  created_at: string
  updated_at: string
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  user_id: string
  read: boolean
  created_at: string
}

function useApi<T>(endpoint: string) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null
  })
  
  const { user } = useAuth()

  const request = useCallback(async (
    path: string, 
    options: RequestInit = {}
  ): Promise<T | null> => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Not authenticated' }))
      return null
    }

    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      // Extract the actual data from the API response structure
      const extractedData = responseData.success ? responseData.data : responseData
      setState({ data: extractedData, loading: false, error: null })
      return extractedData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState({ data: null, loading: false, error: errorMessage })
      return null
    }
  }, [user])

  const get = useCallback((path?: string) => {
    const url = path ? `${endpoint}${path}` : endpoint
    return request(url, { method: 'GET' })
  }, [endpoint, request])

  const post = useCallback((data: any, path?: string) => {
    const url = path ? `${endpoint}${path}` : endpoint
    return request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }, [endpoint, request])

  const put = useCallback((data: any, path?: string) => {
    const url = path ? `${endpoint}${path}` : endpoint
    return request(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }, [endpoint, request])

  const del = useCallback((path?: string) => {
    const url = path ? `${endpoint}${path}` : endpoint
    return request(url, { method: 'DELETE' })
  }, [endpoint, request])

  return {
    ...state,
    get,
    post,
    put,
    delete: del,
    refetch: () => get()
  }
}

export function useClubsApi() {
  return useApi<Club[]>('/api/clubs')
}

export function useTasksApi() {
  return useApi<Task[]>('/api/tasks')
}

export function useMeetingsApi() {
  return useApi<Meeting[]>('/api/meetings')
}

export function useFilesApi() {
  return useApi<FileItem[]>('/api/files')
}

export function useFoldersApi() {
  return useApi<Folder[]>('/api/folders')
}

export function useNotificationsApi() {
  return useApi<Notification[]>('/api/notifications')
}