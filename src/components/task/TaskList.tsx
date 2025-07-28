'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DatabaseService } from '@/lib/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, RefreshCw, User, Calendar } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string
  status: string
  priority: string
  dueDate?: string
  assigneeName?: string
  creatorName?: string
  clubName?: string
  createdAt: string
}

interface TaskListProps {
  clubId?: string
  userId?: string
}

export default function TaskList({ clubId, userId }: TaskListProps) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const filters = {
        clubId,
        userId: userId || user?.id
      }

      const result = await DatabaseService.getTasks(filters, {
        page: 1,
        limit: 50,
        sortBy: 'due_date',
        sortOrder: 'asc'
      })

      if (result.error) {
        setError('Görevler yüklenemedi')
      } else {
        setTasks(result.data)
      }
    } catch (err) {
      setError('Bağlantı hatası')
    } finally {
      setIsLoading(false)
    }
  }, [clubId, userId, user?.id])

  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user, fetchTasks])

  const handleRefresh = useCallback(() => {
    fetchTasks()
  }, [fetchTasks])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'submitted': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getStatusName = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'Bekliyor'
      case 'in_progress': return 'Devam Ediyor'
      case 'submitted': return 'Teslim Edildi'
      case 'completed': return 'Tamamlandı'
      case 'rejected': return 'Reddedildi'
      default: return status
    }
  }, [])

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getPriorityName = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return 'Yüksek'
      case 'medium': return 'Orta'
      case 'low': return 'Düşük'
      default: return priority
    }
  }, [])

  const taskSummary = useMemo(() => {
    const pending = tasks.filter(t => t.status === 'pending').length
    const inProgress = tasks.filter(t => t.status === 'in_progress').length
    const completed = tasks.filter(t => t.status === 'completed').length
    
    return { pending, inProgress, completed, total: tasks.length }
  }, [tasks])

  if (error && tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Görevler yüklenemedi
        </h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Tekrar Dene
        </Button>
      </div>
    )
  }

  if (isLoading && tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Görevler</h3>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Henüz görev bulunmuyor
        </h3>
        <p className="text-gray-500">
          {clubId ? 'Bu kulüpte henüz görev oluşturulmamış.' : 'Size atanmış bir görev bulunmuyor.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Görevler ({taskSummary.total})
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
            <span>Bekliyor: {taskSummary.pending}</span>
            <span>Devam Ediyor: {taskSummary.inProgress}</span>
            <span>Tamamlandı: {taskSummary.completed}</span>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {tasks.map((task) => (
        <Card key={task.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg text-gray-900">{task.title}</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(task.status)}>
                  {getStatusName(task.status)}
                </Badge>
                <Badge className={getPriorityColor(task.priority)}>
                  {getPriorityName(task.priority)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{task.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
              {task.assigneeName && (
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Atanan: {task.assigneeName}</span>
                </div>
              )}
              
              {task.dueDate && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Bitiş: {new Date(task.dueDate).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Oluşturuldu: {new Date(task.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}