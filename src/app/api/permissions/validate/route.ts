import { createClient } from '@/utils/supabase/client';
import { NextResponse } from 'next/server';

// src/app/api/permissions/validate/route.ts
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can validate migration
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { PermissionMigration } = await import('@/lib/permissions');
    const isValid = await PermissionMigration.validateMigration();
    
    return NextResponse.json({
      success: true,
      data: { isValid }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed'
    }, { status: 500 });
  }
}