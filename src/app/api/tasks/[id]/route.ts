// src/app/api/tasks/[id]/route.ts - Task update and delete operations
import { NextRequest } from 'next/server';
import { EnhancedDatabaseService } from '@/lib/database-enhanced';
import { withAuth, ApiResponse, authorizeUser } from '@/lib/api-middleware';
import { createClient } from '@/utils/supabase/server';

// 🔒 GET /api/tasks/[id] - Get specific task
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

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:users!tasks_assigned_to_fkey(name, email),
        creator:users!tasks_assigned_by_fkey(name, email),
        club:clubs(name, id)
      `)
      .eq('id', params.id)
      .single();

    if (error || !task) {
      return ApiResponse.error('Görev bulunamadı', 404);
    }

    // Authorization check
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const canView = userData?.role === 'admin' || 
                   task.assigned_to === user.id || 
                   task.assigned_by === user.id ||
                   (userData?.role === 'club_leader' && task.club_id);

    if (!canView) {
      return ApiResponse.forbidden('Bu görevi görüntüleme yetkiniz yok');
    }

    return ApiResponse.success(task);
  } catch (error) {
    console.error('Task fetch error:', error);
    return ApiResponse.error('Görev bilgileri yüklenemedi');
  }
}

// 🔒 PUT /api/tasks/[id] - Update task
export const PUT = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  try {
    const body = await request.json();
    const taskId = params.id;
    
    const supabase = await createClient();
    
    // Get current task
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !currentTask) {
      return ApiResponse.error('Görev bulunamadı', 404);
    }

    // Authorization check
    const canUpdate = user.role === 'admin' || 
                     currentTask.assigned_by === user.id ||
                     (user.role === 'club_leader' && currentTask.club_id);

    if (!canUpdate) {
      return ApiResponse.forbidden('Bu görevi güncelleme yetkiniz yok');
    }

    // Prepare update data
    const allowedUpdates = ['title', 'description', 'due_date', 'priority', 'status', 'feedback', 'grade'];
    const updates: any = {};
    
    allowedUpdates.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    // Status change validation
    if (body.status) {
      const validStatuses = ['pending', 'in_progress', 'submitted', 'completed', 'rejected'];
      if (!validStatuses.includes(body.status)) {
        return ApiResponse.badRequest('Geçersiz görev durumu');
      }

      if (body.status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }

    // Update timestamp
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Task update error:', error);
      return ApiResponse.error('Görev güncellenemedi');
    }

    return ApiResponse.success(data, 'Görev başarıyla güncellendi');
  } catch (error) {
    console.error('Task update API error:', error);
    return ApiResponse.error('Görev güncellenemedi');
  }
});

// 🔒 DELETE /api/tasks/[id] - Delete task (admin or creator only)
export const DELETE = withAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  try {
    const taskId = params.id;
    const supabase = await createClient();
    
    // Get current task
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !currentTask) {
      return ApiResponse.error('Görev bulunamadı', 404);
    }

    // Authorization check - only admin or task creator can delete
    const canDelete = user.role === 'admin' || currentTask.assigned_by === user.id;

    if (!canDelete) {
      return ApiResponse.forbidden('Bu görevi silme yetkiniz yok');
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Task delete error:', error);
      return ApiResponse.error('Görev silinemedi');
    }

    return ApiResponse.success(null, 'Görev başarıyla silindi');
  } catch (error) {
    console.error('Task delete API error:', error);
    return ApiResponse.error('Görev silinemedi');
  }
}, { allowedRoles: ['admin', 'club_leader'] });