// src/app/api/tasks/route.ts - Enhanced Tasks API
import { NextRequest } from 'next/server';

import { withAuth, ApiResponse, parsePagination, authorizeUser } from '@/lib/api-middleware';
import { DatabaseService } from '@/lib/database';

// 🔒 GET /api/tasks - Get paginated tasks with proper authorization
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { page, limit } = parsePagination(request);
    const { searchParams } = new URL(request.url);
    
    const clubId = searchParams.get('clubId');
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');

    const options = {
      page,
      limit,
      clubId: clubId || undefined,
      assignedTo: assignedTo || undefined,
      status: status || undefined,
      sortBy: searchParams.get('sortBy') || 'due_date',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
    };

    // If specific club requested, check authorization
    if (clubId) {
      const { authorized, error: authError } = authorizeUser(user, undefined, undefined, clubId);
      if (!authorized) {
        return ApiResponse.forbidden(authError);
      }
    }

    const { data, error } = await DatabaseService.getTasks(options, user.id);

    if (error) {
      console.error('Tasks fetch error:', error);
      return ApiResponse.error('Görevler yüklenemedi');
    }

    return ApiResponse.success(data?.data || [], undefined, data?.pagination);
  } catch (error) {
    console.error('Tasks API error:', error);
    return ApiResponse.error('Görevler yüklenemedi');
  }
});

// 🔒 POST /api/tasks - Create new task (admin or club leader only)
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    


    const { title, description, club_id, assigned_to, due_date, priority = 'medium' } = body;

    // Check authorization for the club
    const { authorized, error: authError } = authorizeUser(
      user, 
      undefined, 
      ['admin', 'club_leader'], 
      club_id
    );
    if (!authorized) {
      return ApiResponse.forbidden(authError);
    }

    // Validate due date
    if (due_date) {
      const dueDate = new Date(due_date);
      if (isNaN(dueDate.getTime())) {
        return ApiResponse.badRequest('Geçersiz bitiş tarihi formatı');
      }
      if (dueDate < new Date()) {
        return ApiResponse.badRequest('Bitiş tarihi gelecekte olmalıdır');
      }
    }

    // Prepare task data
    const taskData = {
      title,
      description,
      club_id,
      assigned_by: user.id,
      assigned_to,
      due_date,
      priority,
      status: 'pending' as const,
      files: [],
      created_at: new Date().toISOString(),
    };

    const { data, error } = await DatabaseService.createTask(taskData);

    if (error) {
      console.error('Task creation error:', error);
      return ApiResponse.error('Görev oluşturulamadı');
    }

    return ApiResponse.success(data, 'Görev başarıyla oluşturuldu');
  } catch (error) {
    console.error('Task creation API error:', error);
    return ApiResponse.error('Görev oluşturulamadı');
  }
}, { allowedRoles: ['admin', 'club_leader'] });