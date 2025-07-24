'use client';

import { useEffect, useState } from 'react';
import AuthRedirect from '@/components/auth/AuthRedirect';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useClubsApi, useTasksApi, useMeetingsApi, useNotificationsApi } from '@/hooks/useSimpleApi';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function DashboardPage() {
  const { user } = useAuth();
  const { clubs, fetchClubs, isLoading: clubsLoading } = useClubsApi();
  const { tasks, fetchTasks, isLoading: tasksLoading } = useTasksApi();
  const { meetings, fetchMeetings, isLoading: meetingsLoading } = useMeetingsApi();
  const { notifications, fetchNotifications, isLoading: notificationsLoading } = useNotificationsApi();

  const [stats, setStats] = useState({
    totalClubs: 0,
    activeTasks: 0,
    weeklyMeetings: 0,
    totalNotifications: 0
  });

  useEffect(() => {
    if (user) {
      // Fetch all data when user is available
      fetchClubs();
      fetchTasks();
      fetchMeetings();
      fetchNotifications();
    }
  }, [user?.id]); // Only depend on user.id to prevent infinite loops

  useEffect(() => {
    // Calculate stats when data changes
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activeTasks = tasks.filter(task => 
      task.status === 'pending' || task.status === 'in_progress'
    ).length;

    const weeklyMeetings = meetings.filter(meeting => {
      const meetingDate = new Date(meeting.startTime);
      return meetingDate >= weekStart && meetingDate < weekEnd;
    }).length;

    setStats({
      totalClubs: clubs.length,
      activeTasks,
      weeklyMeetings,
      totalNotifications: notifications.length
    });
  }, [clubs, tasks, meetings, notifications]);

  // Get recent notifications for activity feed
  const recentNotifications = notifications
    .slice(0, 5)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const isLoading = clubsLoading || tasksLoading || meetingsLoading || notificationsLoading;

  return (
    <AuthRedirect redirectType="unauthenticated">
      <MainLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Hoş geldin, {user?.name || 'Kullanıcı'}!
              </h1>
              <p className="text-gray-600">
                Bugün neler yapıyorsun? İşte güncel durumun:
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Toplam Kulüp</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : stats.totalClubs}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Aktif Görev</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : stats.activeTasks}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Bu Hafta Toplantı</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : stats.weeklyMeetings}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Bildirim</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? '...' : stats.totalNotifications}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Son Aktiviteler</h3>
              </div>
              <div className="p-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : recentNotifications.length > 0 ? (
                  <div className="space-y-4">
                    {recentNotifications.map((notification) => (
                      <div key={notification.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(notification.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Henüz aktivite yok</p>
                )}
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Yaklaşan Görevler</h3>
              </div>
              <div className="p-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const upcomingTasks = tasks
                      .filter(task => 
                        (task.status === 'pending' || task.status === 'in_progress') &&
                        task.dueDate &&
                        new Date(task.dueDate) > new Date()
                      )
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .slice(0, 5);

                    return upcomingTasks.length > 0 ? (
                      <div className="space-y-4">
                        {upcomingTasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {task.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                Son tarih: {format(new Date(task.dueDate), 'dd MMM yyyy', { locale: tr })}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                task.priority === 'high' 
                                  ? 'bg-red-100 text-red-800'
                                  : task.priority === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {task.priority === 'high' ? 'Yüksek' : 
                                 task.priority === 'medium' ? 'Orta' : 'Düşük'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">Yaklaşan görev yok</p>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthRedirect>
  );
}