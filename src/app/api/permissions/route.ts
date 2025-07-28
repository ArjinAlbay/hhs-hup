import { NextRequest, NextResponse } from 'next/server';
import { PermissionService } from '@/lib/permissions';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const permissions = await PermissionService.getAllPermissions();
    const permissionsByCategory = await PermissionService.getPermissionsByCategory();
    
    return NextResponse.json({
      success: true,
      data: {
        permissions,
        permissionsByCategory
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch permissions'
    }, { status: 500 });
  }
}
