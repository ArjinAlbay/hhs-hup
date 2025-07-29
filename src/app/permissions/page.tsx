import { MainLayoutContent } from '@/components/layout/MainLayout'
import PermissionGuard from '@/components/admin/PermissionGuard'

export default function PermissionsPage() {
  return (
    <MainLayoutContent>
      <PermissionGuard requiredRole="admin">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Yetki Yönetimi</h1>
            <p className="text-gray-600">Kullanıcı yetkilerini düzenleyin</p>
          </div>
        </div>
      </PermissionGuard>
    </MainLayoutContent>
  )
}