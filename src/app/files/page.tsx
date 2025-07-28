// src/app/files/page.tsx
import FilesPageContent from '@/components/file/FilesPageContent'
import AuthLayout from '@/components/layout/AuthLayout'

export default function FilesPage() {
  return (
    <AuthLayout>
      <FilesPageContent />
    </AuthLayout>
  )
}