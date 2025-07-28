// src/app/api/clubs/route.ts - Enhanced Clubs API with proper security
import { NextRequest } from 'next/server';
import { EnhancedDatabaseService } from '@/lib/database-enhanced';
import { withAuth, ApiResponse, parsePagination } from '@/lib/api-middleware';
import { validateClubData } from '@/lib/validation';

// 🔒 GET /api/clubs - Get paginated clubs with role-based filtering
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { page, limit } = parsePagination(request);
    const { searchParams } = new URL(request.url);
    
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const type = searchParams.get('type'); // Filter by club type
    const search = searchParams.get('search'); // Search in name/description

    const options = {
      page,
      limit,
      sortBy,
      sortOrder,
      filters: {
        ...(type && { type }),
        is_active: true
      }
    };

    const { data, error } = await EnhancedDatabaseService.getClubs(options, user.id);
    
    if (error) {
      console.error('Clubs fetch error:', error);
      return ApiResponse.error('Kulüpler yüklenemedi');
    }

    // Apply search filter if provided (client-side for now, can be moved to DB)
    let filteredData = data?.data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(club => 
        club.name.toLowerCase().includes(searchLower) ||
        club.description?.toLowerCase().includes(searchLower)
      );
    }

    return ApiResponse.success(filteredData, undefined, {
      ...data?.pagination,
      total: filteredData.length
    });
  } catch (error) {
    console.error('Clubs API error:', error);
    return ApiResponse.error('Kulüpler yüklenemedi');
  }
});

// 🔒 POST /api/clubs - Create new club (admin or club_leader only)
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateClubData(body);
    if (!validation.isValid) {
      return ApiResponse.badRequest(
        `Validation error: ${Object.values(validation.errors).join(', ')}`
      );
    }

    const { name, description, type = 'social' } = body;

    // Check for duplicate club names
    const { data: existingClub } = await EnhancedDatabaseService.getClubs({
      page: 1,
      limit: 1,
      filters: { name }
    });

    if (existingClub?.data.length > 0) {
      return ApiResponse.badRequest('Bu isimde bir kulüp zaten mevcut');
    }

    // Additional validation for club leaders (can only create one club)
    if (user.role === 'club_leader') {
      const { data: userClubs } = await EnhancedDatabaseService.getClubs({
        page: 1,
        limit: 1,
        filters: { leader_id: user.id }
      }, user.id);

      if (userClubs?.data.length > 0) {
        return ApiResponse.badRequest('Kulüp liderleri sadece bir kulüp oluşturabilir');
      }
    }

    const allowedTypes = ['social', 'education', 'project'];
    if (!allowedTypes.includes(type)) {
      return ApiResponse.badRequest('Geçersiz kulüp tipi');
    }

    // Set default settings based on club type
    const defaultSettings = {
      social: {
        maxFileSize: 10485760, // 10MB
        requireApproval: false,
        allowMemberTasks: true,
        publicVisible: true,
        maxMembers: 50
      },
      education: {
        maxFileSize: 26214400, // 25MB
        requireApproval: true,
        allowMemberTasks: true,
        publicVisible: false,
        maxMembers: 30,
        allowedFileTypes: ['pdf', 'doc', 'docx', 'ppt', 'pptx']
      },
      project: {
        maxFileSize: 52428800, // 50MB
        requireApproval: false,
        allowMemberTasks: true,
        publicVisible: true,
        maxMembers: 20,
        allowedFileTypes: ['pdf', 'doc', 'docx', 'zip', 'rar', 'tar.gz']
      }
    };

    const clubData = {
      name: name.trim(),
      description: description.trim(),
      type,
      leader_id: user.id,
      is_active: true,
      settings: defaultSettings[type as keyof typeof defaultSettings],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await EnhancedDatabaseService.createClub(clubData);
    
    if (error) {
      console.error('Club creation error:', error);
      return ApiResponse.error('Kulüp oluşturulamadı');
    }

    // Auto-join the creator as first member (if they're not admin)
    if (user.role === 'club_leader') {
      try {
        const supabase = await (await import('@/utils/supabase/server')).createClient();
        await supabase
          .from('club_members')
          .insert({
            club_id: data.id,
            user_id: user.id,
            joined_at: new Date().toISOString()
          });
      } catch (memberError) {
        console.warn('Failed to auto-join creator as member:', memberError);
      }
    }

    return ApiResponse.success(data, 'Kulüp başarıyla oluşturuldu');
  } catch (error) {
    console.error('Club creation API error:', error);
    return ApiResponse.error('Kulüp oluşturulamadı');
  }
}, { allowedRoles: ['admin', 'club_leader'] });