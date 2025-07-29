
import { MainLayoutContent } from '@/components/layout/MainLayout'
import { EnhancedDatabaseService } from '@/lib/database-enhanced'

function getStartOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

export default async function DashboardPage() {
  // Toplam Kulüpler
  const clubsRes = await EnhancedDatabaseService.getClubs({ limit: 1 })
  const totalClubs = clubsRes.pagination?.total || 0

  // Aktif Görevler (status: 'pending' or 'active')
  const tasksRes = await EnhancedDatabaseService.getTasks({ status: 'pending' }, { limit: 1 })
  const totalTasks = tasksRes.pagination?.total || 0

  // Bu Hafta Toplantılar
  const now = new Date()
  const startOfWeek = getStartOfWeek(now)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  const meetingsRes = await EnhancedDatabaseService.getMeetings({
    filters: {
      start_time: `gte.${startOfWeek.toISOString()}`,
      end_time: `lte.${endOfWeek.toISOString()}`,
    },
    limit: 1,
  })
  const totalMeetings = meetingsRes.pagination?.total || 0

  // Yeni Dosyalar (last 7 days)
  const lastWeek = new Date()
  lastWeek.setDate(now.getDate() - 7)
  const filesRes = await EnhancedDatabaseService.getFiles({
    filters: {
      created_at: `gte.${lastWeek.toISOString()}`,
    },
    limit: 1,
  })
  const totalFiles = filesRes.pagination?.total || 0

  return (
    <MainLayoutContent>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Hoş geldiniz! İşte genel bakışınız</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Toplam Kulüpler</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{totalClubs}</p>
            <p className="text-sm text-gray-500 mt-1">Aktif kulüp sayısı</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Aktif Görevler</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{totalTasks}</p>
            <p className="text-sm text-gray-500 mt-1">Bekleyen görevler</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Bu Hafta Toplantılar</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">{totalMeetings}</p>
            <p className="text-sm text-gray-500 mt-1">Bu haftaki toplantı sayısı</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Yeni Dosyalar</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">{totalFiles}</p>
            <p className="text-sm text-gray-500 mt-1">Son 7 gün içinde eklenen dosyalar</p>
          </div>
        </div>
      </div>
    </MainLayoutContent>
  )
}