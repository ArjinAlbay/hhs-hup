// src/app/tasks/page.tsx (if exists)

import AuthLayout from '@/components/layout/AuthLayout'

export default function TasksPage() {
  return (
    <AuthLayout>
      <TasksPageContent />
    </AuthLayout>
  )
}