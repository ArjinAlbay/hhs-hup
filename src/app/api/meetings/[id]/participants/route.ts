// src/app/api/meetings/[id]/participants/route.ts - Enhanced Meeting Participants API
import { NextRequest } from 'next/server';
import { withAuth, ApiResponse, authorizeUser } from '@/lib/api-middleware';
import { createClient } from '@/utils/supabase/server';

// 🔒 GET /api/meetings/[id]/participants - Get meeting participants
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

    const meetingId = params.id;

    // Check if meeting exists and user has access
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, club_id, organizer_id, title')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return ApiResponse.error('Toplantı bulunamadı', 404);
    }

    // Authorization check
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const canView = userData?.role === 'admin' || 
                   meeting.organizer_id === user.id ||
                   await isClubMember(meeting.club_id, user.id);

    if (!canView) {
      return ApiResponse.forbidden('Toplantı katılımcılarını görüntüleme yetkiniz yok');
    }

    // Get participants
    const { data: participants, error } = await supabase
      .from('meeting_participants')
      .select(`
        id,
        response,
        joined_at,
        user:users!meeting_participants_user_id_fkey(
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('meeting_id', meetingId)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Participants fetch error:', error);
      return ApiResponse.error('Katılımcılar yüklenemedi');
    }

    // Get response statistics
    const responseStats = {
      total: participants?.length || 0,
      accepted: participants?.filter(p => p.response === 'accepted').length || 0,
      declined: participants?.filter(p => p.response === 'declined').length || 0,
      pending: participants?.filter(p => p.response === 'pending').length || 0
    };

    return ApiResponse.success({
      participants: participants || [],
      stats: responseStats,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        organizer_id: meeting.organizer_id
      }
    });
  } catch (error) {
    console.error('Participants API error:', error);
    return ApiResponse.error('Katılımcılar yüklenemedi');
  }
}

// 🔒 POST /api/meetings/[id]/participants - Add participants to meeting
export const POST = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  try {
    const body = await request.json();
    const meetingId = params.id;
    const { user_ids } = body; // Array of user IDs to add

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return ApiResponse.badRequest('Katılımcı ID listesi gerekli');
    }

    const supabase = await createClient();

    // Check if meeting exists
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, club_id, organizer_id, start_time, status')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return ApiResponse.error('Toplantı bulunamadı', 404);
    }

    // Authorization check (only organizer or admin can add participants)
    const canAdd = user.role === 'admin' || meeting.organizer_id === user.id;

    if (!canAdd) {
      return ApiResponse.forbidden('Katılımcı ekleme yetkiniz yok');
    }

    // Check if meeting is in the future
    if (new Date(meeting.start_time) < new Date() && meeting.status !== 'scheduled') {
      return ApiResponse.badRequest('Geçmiş toplantılara katılımcı eklenemez');
    }

    // Validate that all users exist and are club members
    const { data: clubMembers, error: membersError } = await supabase
      .from('club_members')
      .select('user_id, users!club_members_user_id_fkey(id, name, email, is_active)')
      .eq('club_id', meeting.club_id)
      .in('user_id', user_ids);

    if (membersError) {
      return ApiResponse.error('Kulüp üyeleri kontrol edilemedi');
    }

    const validUserIds = clubMembers
      ?.filter(m => m.users?.is_active)
      .map(m => m.user_id) || [];

    const invalidUserIds = user_ids.filter(id => !validUserIds.includes(id));
    if (invalidUserIds.length > 0) {
      return ApiResponse.badRequest(
        `Şu kullanıcılar kulüp üyesi değil veya aktif değil: ${invalidUserIds.join(', ')}`
      );
    }

    // Check for existing participants
    const { data: existingParticipants } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', meetingId)
      .in('user_id', user_ids);

    const existingUserIds = existingParticipants?.map(p => p.user_id) || [];
    const newUserIds = user_ids.filter(id => !existingUserIds.includes(id));

    if (newUserIds.length === 0) {
      return ApiResponse.badRequest('Tüm kullanıcılar zaten katılımcı');
    }

    // Add new participants
    const participantsToAdd = newUserIds.map(userId => ({
      meeting_id: meetingId,
      user_id: userId,
      response: 'pending',
      joined_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('meeting_participants')
      .insert(participantsToAdd)
      .select(`
        id,
        response,
        joined_at,
        user:users!meeting_participants_user_id_fkey(
          id,
          name,
          email
        )
      `);

    if (error) {
      console.error('Participants add error:', error);
      return ApiResponse.error('Katılımcılar eklenemedi');
    }

    return ApiResponse.success({
      added: data || [],
      skipped: existingUserIds,
      message: `${newUserIds.length} katılımcı eklendi, ${existingUserIds.length} zaten mevcut`
    });
  } catch (error) {
    console.error('Add participants API error:', error);
    return ApiResponse.error('Katılımcılar eklenemedi');
  }
});

// 🔒 DELETE /api/meetings/[id]/participants/[userId] - Remove participant
export const DELETE = withAuth(async (request: NextRequest, user, { params }: { params: { id: string; userId: string } }) => {
  try {
    const meetingId = params.id;
    const targetUserId = params.userId;

    const supabase = await createClient();

    // Check if meeting exists
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, organizer_id, start_time, status')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return ApiResponse.error('Toplantı bulunamadı', 404);
    }

    // Authorization check (organizer, admin, or user removing themselves)
    const canRemove = user.role === 'admin' || 
                     meeting.organizer_id === user.id ||
                     targetUserId === user.id;

    if (!canRemove) {
      return ApiResponse.forbidden('Katılımcı çıkarma yetkiniz yok');
    }

    // Check if meeting is in the future (can't remove from past meetings)
    if (new Date(meeting.start_time) < new Date() && meeting.status === 'completed') {
      return ApiResponse.badRequest('Tamamlanmış toplantılardan katılımcı çıkarılamaz');
    }

    // Check if participant exists
    const { data: participant, error: participantError } = await supabase
      .from('meeting_participants')
      .select('id')
      .eq('meeting_id', meetingId)
      .eq('user_id', targetUserId)
      .single();

    if (participantError || !participant) {
      return ApiResponse.error('Katılımcı bulunamadı', 404);
    }

    // Remove participant
    const { error } = await supabase
      .from('meeting_participants')
      .delete()
      .eq('meeting_id', meetingId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Participant remove error:', error);
      return ApiResponse.error('Katılımcı çıkarılamadı');
    }

    return ApiResponse.success(null, 'Katılımcı başarıyla çıkarıldı');
  } catch (error) {
    console.error('Remove participant API error:', error);
    return ApiResponse.error('Katılımcı çıkarılamadı');
  }
});

// Helper function
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