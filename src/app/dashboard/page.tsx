import AuthLayout from '@/components/layout/AuthLayout'

export default function DashboardPage() {
  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Hoş geldiniz! İşte genel bakışınız</p>
        </div>
      </div>
    </AuthLayout>
  )
}