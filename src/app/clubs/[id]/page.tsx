
import { MainLayoutContent } from '@/components/layout/MainLayout'
import ClubDetail from '@/components/club/ClubDetail'

interface ClubDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { id } = await params
  
  return (
    <MainLayoutContent>
      <ClubDetail clubId={id} />
    </MainLayoutContent>
  )
}