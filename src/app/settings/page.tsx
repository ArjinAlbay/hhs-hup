import AuthLayout from '@/components/layout/AuthLayout'

export default function SettingsPage() {
  return (
    <AuthLayout allowedRoles={['admin', 'club_leader']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ayarlar</h1>
          <p className="text-gray-600">Sistem ayarlarını buradan yapabilirsiniz</p>
        </div>
      </div>
    </AuthLayout>
  )
}