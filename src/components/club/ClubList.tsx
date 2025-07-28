'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DatabaseService } from '@/lib/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Calendar, CheckSquare, Plus, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  description: string
  type: 'education' | 'social' | 'project'
  leaderName: string
  memberCount: number
  createdAt: string
}

export default function ClubList() {
  const { user, isAdmin, isLeader } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClubs = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const result = await DatabaseService.getClubs(user?.id, {
        page: 1,
        limit: 50,
        sortBy: 'created_at',
        sortOrder: 'desc'
      })
      
      if (result.error) {
        setError('Kulüpler yüklenemedi')
      } else {
        setClubs(result.data)
      }
    } catch (err) {
      setError('Bağlantı hatası')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user) {
      fetchClubs()
    }
  }, [user, fetchClubs])

  const handleRefresh = useCallback(() => {
    fetchClubs()
  }, [fetchClubs])

  const getClubTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'education': return 'bg-blue-100 text-blue-800'
      case 'social': return 'bg-green-100 text-green-800'
      case 'project': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getClubTypeName = useCallback((type: string) => {
    switch (type) {
      case 'education': return 'Eğitim'
      case 'social': return 'Sosyal'
      case 'project': return 'Proje'
      default: return type
    }
  }, [])

  const canCreateClub = useMemo(() => {
    return isAdmin || isLeader
  }, [isAdmin, isLeader])

  if (isLoading && clubs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kulüpler</h1>
            <p className="text-gray-600">Kulüpler yükleniyor...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error && clubs.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Kulüpler yüklenemedi
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kulüpler</h1>
          <p className="text-gray-600">
            {clubs.length} kulüp bulundu
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {canCreateClub && (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Kulüp
            </Button>
          )}
        </div>
      </div>

      {clubs.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Henüz kulüp bulunmuyor
          </h3>
          <p className="text-gray-500 mb-4">
            İlk kulübü oluşturun ve topluluğunuzu başlatın.
          </p>
          {canCreateClub && (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              İlk Kulübü Oluştur
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{club.name}</CardTitle>
                    <Badge className={getClubTypeColor(club.type)}>
                      {getClubTypeName(club.type)}
                    </Badge>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {club.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{club.memberCount} üye</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>3 toplantı</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CheckSquare className="h-4 w-4" />
                        <span>5 görev</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    Lider: {club.leaderName}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}