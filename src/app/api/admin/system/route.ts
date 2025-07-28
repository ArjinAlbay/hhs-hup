// src/app/api/admin/system/route.ts - System management API
import { NextRequest } from 'next/server';
import { withAuth, ApiResponse } from '@/lib/api-middleware';
import { createClient } from '@/utils/supabase/server';

// 🔒 GET /api/admin/system - Get system statistics and health
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const supabase = await createClient();

    // Get system statistics
    const [
      { count: totalUsers },
      { count: totalClubs },
      { count: totalTasks },
      { count: totalMeetings },
      { count: totalFiles },
      { count: activeUsers },
      { count: activeClubs }
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('clubs').select('id', { count: 'exact' }),
      supabase.from('tasks').select('id', { count: 'exact' }),
      supabase.from('meetings').select('id', { count: 'exact' }),
      supabase.from('files').select('id', { count: 'exact' }),
      supabase.from('users').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('clubs').select('id', { count: 'exact' }).eq('is_active', true)
    ]);

    // Get recent activities
    const { data: recentActivities } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        title,
        created_at,
        creator:users!activities_created_by_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get club type distribution
    const { data: clubTypes } = await supabase
      .from('clubs')
      .select('type')
      .eq('is_active', true);

    const clubTypeDistribution = clubTypes?.reduce((acc, club) => {
      acc[club.type] = (acc[club.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get task status distribution
    const { data: taskStatuses } = await supabase
      .from('tasks')
      .select('status');

    const taskStatusDistribution = taskStatuses?.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Calculate storage usage (approximate)
    const { data: filesSizes } = await supabase
      .from('files')
      .select('file_size');

    const totalStorage = filesSizes?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;

    const systemStats = {
      overview: {
        totalUsers: totalUsers || 0,
        totalClubs: totalClubs || 0,
        totalTasks: totalTasks || 0,
        totalMeetings: totalMeetings || 0,
        totalFiles: totalFiles || 0,
        activeUsers: activeUsers || 0,
        activeClubs: activeClubs || 0,
        totalStorageBytes: totalStorage
      },
      distributions: {
        clubTypes: clubTypeDistribution,
        taskStatuses: taskStatusDistribution
      },
      recentActivities: recentActivities || [],
      systemHealth: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    return ApiResponse.success(systemStats);
  } catch (error) {
    console.error('System stats error:', error);
    return ApiResponse.error('Sistem istatistikleri yüklenemedi');
  }
}, { requiredRole: 'admin' });

// 🔒 POST /api/admin/system/maintenance - Trigger maintenance tasks
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { action } = body;

    const supabase = await createClient();
    const results: any = {};

    switch (action) {
      case 'cleanup_inactive_users':
        // Mark users inactive if they haven't logged in for 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const { count: inactiveCount } = await supabase
          .from('users')
          .update({ is_active: false })
          .lt('last_login_at', sixMonthsAgo.toISOString())
          .eq('is_active', true)
          .select('id', { count: 'exact' });

        results.inactiveUsers = inactiveCount || 0;
        break;

      case 'cleanup_old_activities':
        // Delete activities older than 1 year
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const { count: deletedActivities } = await supabase
          .from('activities')
          .delete()
          .lt('created_at', oneYearAgo.toISOString())
          .select('id', { count: 'exact' });

        results.deletedActivities = deletedActivities || 0;
        break;

      case 'update_storage_stats':
        // Recalculate storage usage for all clubs
        const { data: clubs } = await supabase
          .from('clubs')
          .select('id');

        if (clubs) {
          for (const club of clubs) {
            const { data: clubFiles } = await supabase
              .from('files')
              .select('file_size')
              .eq('club_id', club.id);

            const totalSize = clubFiles?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
            
            await supabase
              .from('clubs')
              .update({ 
                settings: { 
                  ...club.settings, 
                  currentStorageUsage: totalSize 
                } 
              })
              .eq('id', club.id);
          }
        }
        
        results.updatedClubs = clubs?.length || 0;
        break;

      default:
        return ApiResponse.badRequest('Geçersiz bakım işlemi');
    }

    // Log maintenance action
    await supabase
      .from('activities')
      .insert({
        type: 'notification',
        title: `Bakım İşlemi: ${action}`,
        content: `Admin ${user.id} tarafından ${action} bakım işlemi gerçekleştirildi`,
        created_by: user.id,
        target_users: [user.id],
        metadata: { maintenance: true, results }
      });

    return ApiResponse.success(results, 'Bakım işlemi tamamlandı');
  } catch (error) {
    console.error('Maintenance error:', error);
    return ApiResponse.error('Bakım işlemi başarısız');
  }
}, { requiredRole: 'admin' });