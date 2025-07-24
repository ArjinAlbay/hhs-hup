
import MainLayout from '@/components/layout/MainLayout';
import ClubDetail from '@/components/club/ClubDetail';

interface ClubDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { id } = await params;
  
  return (
    <MainLayout>
      <ClubDetail clubId={id} />
    </MainLayout>
  );
}