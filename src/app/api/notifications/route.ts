// src/app/api/notifications/route.ts - Fixed notifications API
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, ApiResponse, parsePagination } from '@/lib/api-middleware';
import { createClient } from '@/utils/supabase/server';

// 🔒 GET /api/notifications - Get user notifications
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { page, limit } = parsePagination(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const unreadOnly = searchParams.get('unread') === 'true';
    
    const supabase = await createClient();
    const offset = (page - 1) * limit;

    // Build query for activities that serve as notifications
    let query = supabase
      .from('activities')
      .select('*', { count: 'exact' })
      .contains('target_users', [user.id])
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    const { data: activities, error, count } = await query;
    
    if (error) {
      console.error('Notifications fetch error:', error);
      return ApiResponse.error('Bildirimler yüklenemedi');
    }

    // Transform activities to notifications format
    const notifications = activities?.map(activity => {
      const isRead = activity.metadata?.read_by?.includes(user.id) || false;
      
      return {
        id: activity.id,
        title: activity.title,
        message: activity.content || '',
        type: activity.type === 'notification' ? 'general' : 
              activity.type === 'meeting' ? 'meeting' : 
              activity.type === 'announcement' ? 'club' : 'general',
        is_read: isRead,
        created_at: activity.created_at,
        action_url: activity.metadata?.action_url || null,
        club_id: activity.club_id,
        created_by: activity.created_by
      };
    }).filter(notification => {
      // Apply unread filter if requested
      if (unreadOnly) {
        return !notification.is_read;
      }
      return true;
    }) || [];

    return ApiResponse.success(notifications, undefined, {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error('Notifications API error:', error);
    return ApiResponse.error('Bildirimler yüklenemedi');
  }
});

// 🔒 POST /api/notifications - Create notification (admin/club leaders only)
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { title, content, type = 'notification', club_id, target_users, action_url } = body;
    
    if (!title || !target_users || !Array.isArray(target_users) || target_users.length === 0) {
      return ApiResponse.badRequest('Başlık ve hedef kullanıcılar gerekli');
    }

    // Authorization check
    if (user.role !== 'admin' && user.role !== 'club_leader') {
      return ApiResponse.forbidden('Bildirim oluşturma yetkiniz yok');
    }

    // If club_id provided, check if user can send notifications for this club
    if (club_id && user.role === 'club_leader') {
      const supabase = await createClient();
      const { data: club } = await supabase
        .from('clubs')
        .select('leader_id')
        .eq('id', club_id)
        .single();

      if (!club || club.leader_id !== user.id) {
        return ApiResponse.forbidden('Bu kulüp için bildirim gönderme yetkiniz yok');
      }
    }

    // Validate target users exist
    const supabase = await createClient();
    const { data: validUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .in('id', target_users)
      .eq('is_active', true);

    if (usersError || !validUsers || validUsers.length !== target_users.length) {
      return ApiResponse.badRequest('Bazı hedef kullanıcılar bulunamadı veya aktif değil');
    }

    // Create activity as notification
    const activityData = {
      type,
      title,
      content,
      club_id,
      created_by: user.id,
      target_users,
      metadata: {
        action_url,
        read_by: [],
        notification_type: 'system'
      },
      is_active: true,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single();

    if (error) {
      console.error('Notification creation error:', error);
      return ApiResponse.error('Bildirim oluşturulamadı');
    }

    return ApiResponse.success(data, 'Bildirim başarıyla oluşturuldu');
  } catch (error) {
    console.error('Notification creation API error:', error);
    return ApiResponse.error('Bildirim oluşturulamadı');
  }
}, { allowedRoles: ['admin', 'club_leader'] });

// 🔒 PUT /api/notifications/[id] - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_id, user_id, action } = body;
    
    if (!notification_id || !user_id || !action) {
      return ApiResponse.badRequest('Gerekli parametreler eksik');
    }

    const supabase = await createClient();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== user_id) {
      return ApiResponse.unauthorized('Authentication required');
    }

    // Get current activity
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', notification_id)
      .single();
    
    if (fetchError || !activity) {
      return ApiResponse.error('Bildirim bulunamadı', 404);
    }

    // Check if user is in target_users
    if (!activity.target_users?.includes(user_id)) {
      return ApiResponse.forbidden('Bu bildirimi görüntüleme yetkiniz yok');
    }

    let updatedMetadata = activity.metadata || {};
    
    if (action === 'mark_read') {
      const readBy = updatedMetadata.read_by || [];
      if (!readBy.includes(user_id)) {
        updatedMetadata.read_by = [...readBy, user_id];
      }
    } else if (action === 'mark_unread') {
      const readBy = updatedMetadata.read_by || [];
      updatedMetadata.read_by = readBy.filter((id: string) => id !== user_id);
    }

    // Update the activity
    const { error: updateError } = await supabase
      .from('activities')
      .update({ metadata: updatedMetadata })
      .eq('id', notification_id);

    if (updateError) {
      console.error('Notification update error:', updateError);
      return ApiResponse.error('Bildirim güncellenemedi');
    }

    return ApiResponse.success(null, 'Bildirim güncellendi');
  } catch (error) {
    console.error('Notification update API error:', error);
    return ApiResponse.error('Bildirim güncellenemedi');
  }
}

// 🔒 DELETE /api/notifications/[id] - Delete notification (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return ApiResponse.unauthorized('Authentication required');
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return ApiResponse.forbidden('Bildirim silme yetkiniz yok');
    }

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Notification delete error:', error);
      return ApiResponse.error('Bildirim silinemedi');
    }

    return ApiResponse.success(null, 'Bildirim silindi');
  } catch (error) {
    console.error('Notification delete API error:', error);
    return ApiResponse.error('Bildirim silinemedi');
  }
}