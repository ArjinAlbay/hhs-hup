import { PermissionService } from '@/lib/permissions';
import { createClient } from '@/utils/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Users can only view their own permissions unless they're admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin' && user.id !== params.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = await PermissionService.getUserEffectivePermissions(params.userId);
    
    return NextResponse.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user permissions'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can grant permissions
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { permissionName, expiresAt, context } = body;

    if (!permissionName) {
      return NextResponse.json({
        success: false,
        error: 'Permission name is required'
      }, { status: 400 });
    }

    const success = await PermissionService.grantPermission(
      params.userId,
      permissionName,
      user.id,
      { expiresAt, context }
    );

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to grant permission'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Permission granted successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Server error'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can revoke permissions
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { permissionName } = body;

    if (!permissionName) {
      return NextResponse.json({
        success: false,
        error: 'Permission name is required'
      }, { status: 400 });
    }

    const success = await PermissionService.revokePermission(params.userId, permissionName);

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to revoke permission'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Permission revoked successfully'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Server error'
    }, { status: 500 });
  }
}