
import ClubList from '@/components/club/ClubList';
import AuthLayout from '@/components/layout/AuthLayout';
import { createClient } from '@/utils/supabase/server';

export default async function ClubsPage() {
  // 🔒 Server-side authentication check
  const supabase = await createClient();



  return (
    <AuthLayout>
      <ClubList />
    </AuthLayout>
  );
}