import { createClient } from '@/utils/supabase/client';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can run migration
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if migration was already run
    const { data: existingPermissions } = await supabase
      .from('user_permissions')
      .select('id')
      .limit(1);

    if (existingPermissions && existingPermissions.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Migration already completed'
      }, { status: 400 });
    }

    // Run migration
    const { PermissionMigration } = await import('@/lib/permissions');
    await PermissionMigration.migrateFromOldSystem();
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 });
  }
}
