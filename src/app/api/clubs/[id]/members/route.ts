// src/app/api/clubs/[id]/members/route.ts - Club membership management
import { NextRequest } from 'next/server';
import { withAuth, ApiResponse, parsePagination, authorizeUser } from '@/lib/api-middleware';
import { createClient } from '@/utils/supabase/server';

// 🔒 GET /api/clubs/[id]/members - Get club members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return ApiResponse.unauthorized('Authentication required');
    }

    const clubId = params.id;
    const { page, limit } = parsePagination(request);

    // Check if user can view club members
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const canView = userData?.role === 'admin' || 
                   await isClubMember(clubId, user.id) ||
                   await isClubLeader(clubId, user.id);

    if (!canView) {
      return ApiResponse.forbidden('Kulüp üyelerini görüntüleme yetkiniz yok');
    }

    // Get members with pagination
    const offset = (page - 1) * limit;
    
    const { data: members, error, count } = await supabase
      .from('club_members')
      .select(`
        id,
        joined_at,
        user:users!club_members_user_id_fkey(
          id,
          name,
          email,
          role,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('club_id', clubId)
      .range(offset, offset + limit - 1)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Members fetch error:', error);
      return ApiResponse.error('Üyeler yüklenemedi');
    }

    // Get club leader info
    const { data: club } = await supabase
      .from('clubs')
      .select('leader_id, users!clubs_leader_id_fkey(id, name, email, role, avatar_url)')
      .eq('id', clubId)
      .single();

    const response = {
      members: members || [],
      leader: club?.users || null,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };

    return ApiResponse.success(response);
  } catch (error) {
    console.error('Members API error:', error);
    return ApiResponse.error('Üyeler yüklenemedi');
  }
}

// 🔒 POST /api/clubs/[id]/members - Add member to club
export const POST = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  try {
    const body = await request.json();
    const clubId = params.id;
    const { user_id } = body;

    if (!user_id) {
      return ApiResponse.badRequest('Kullanıcı ID gerekli');
    }

    const supabase = await createClient();

    // Check authorization (admin, club leader, or user adding themselves)
    const canAdd = user.role === 'admin' || 
                  await isClubLeader(clubId, user.id) ||
                  user_id === user.id;

    if (!canAdd) {
      return ApiResponse.forbidden('Üye ekleme yetkiniz yok');
    }

    // Check if club exists and is active
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, name, settings, is_active')
      .eq('id', clubId)
      .eq('is_active', true)
      .single();

    if (clubError || !club) {
      return ApiResponse.error('Kulüp bulunamadı', 404);
    }

    // Check if user exists and is active
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, name, email, is_active')
      .eq('id', user_id)
      .eq('is_active', true)
      .single();

    if (userError || !targetUser) {
      return ApiResponse.error('Kullanıcı bulunamadı', 404);
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', user_id)
      .single();

    if (existingMember) {
      return ApiResponse.badRequest('Kullanıcı zaten bu kulübün üyesi');
    }

    // Check member limit
    if (club.settings?.maxMembers) {
      const { count } = await supabase
        .from('club_members')
        .select('id', { count: 'exact' })
        .eq('club_id', clubId);

      if (count && count >= club.settings.maxMembers) {
        return ApiResponse.badRequest('Kulüp üye limiti doldu');
      }
    }

    // Add member
    const { data, error } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: user_id,
        joined_at: new Date().toISOString()
      })
      .select(`
        id,
        joined_at,
        user:users!club_members_user_id_fkey(
          id,
          name,
          email,
          role
        )
      `)
      .single();

    if (error) {
      console.error('Member add error:', error);
      return ApiResponse.error('Üye eklenemedi');
    }

    return ApiResponse.success(data, 'Üye başarıyla eklendi');
  } catch (error) {
    console.error('Add member API error:', error);
    return ApiResponse.error('Üye eklenemedi');
  }
});

// 🔒 DELETE /api/clubs/[id]/members/[userId] - Remove member from club
export const DELETE = withAuth(async (request: NextRequest, user, { params }: { params: { id: string; userId: string } }) => {
  try {
    const clubId = params.id;
    const targetUserId = params.userId;

    const supabase = await createClient();

    // Check authorization (admin, club leader, or user removing themselves)
    const canRemove = user.role === 'admin' || 
                     await isClubLeader(clubId, user.id) ||
                     targetUserId === user.id;

    if (!canRemove) {
      return ApiResponse.forbidden('Üye çıkarma yetkiniz yok');
    }

    // Check if membership exists
    const { data: membership, error: memberError } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', targetUserId)
      .single();

    if (memberError || !membership) {
      return ApiResponse.error('Üyelik bulunamadı', 404);
    }

    // Remove member
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Member remove error:', error);
      return ApiResponse.error('Üye çıkarılamadı');
    }

    return ApiResponse.success(null, 'Üye başarıyla çıkarıldı');
  } catch (error) {
    console.error('Remove member API error:', error);
    return ApiResponse.error('Üye çıkarılamadı');
  }
});

// Helper functions
async function isClubMember(clubId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

async function isClubLeader(clubId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('leader_id', userId)
    .single();
  return !!data;
}