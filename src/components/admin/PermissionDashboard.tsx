// ============================================
// 📊 ADVANCED PERMISSION DASHBOARD
// ============================================

// src/components/admin/PermissionDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Users, 
  Shield, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  Settings,
  Download,
  Upload,
  Zap
} from 'lucide-react';

import { AdvancedPermissionService, PermissionAnalytics, PermissionCache } from '@/lib/permissions-advanced';
import { usePermissionAdmin } from '@/hooks/usePermissionAdmin';
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
  totalPermissions: number;
  activeUsers: number;
  recentGrants: number;
  recentRevokes: number;
  cacheHitRate: number;
  expiredPermissions: number;
}

interface PermissionUsage {
  permission_name: string;
  usage_count: number;
  last_used_at: string;
}

export default function PermissionDashboard() {
  const { user } = useAuth();
  const { loading, error } = usePermissionAdmin();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usageData, setUsageData] = useState<PermissionUsage[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');

  useEffect(() => {
    loadDashboardData();
  }, [selectedTimeRange]);

  const loadDashboardData = async () => {
    try {
      const [analyticsData, permissionStats, cacheStats] = await Promise.all([
        PermissionAnalytics.generatePermissionReport({ 
          timeRange: selectedTimeRange,
          includeUsage: true 
        }),
        AdvancedPermissionService.getPermissionStats(),
        PermissionCache.getStats()
      ]);

      setStats({
        totalPermissions: permissionStats.totalPermissions,
        activeUsers: permissionStats.activeUsers,
        recentGrants: analyticsData.summary.recentGrants || 0,
        recentRevokes: analyticsData.summary.recentRevokes || 0,
        cacheHitRate: cacheStats.hitRate,
        expiredPermissions: 0 // Would need separate endpoint
      });

      setUsageData(analyticsData.usage);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const runMigration = async () => {
    setMigrationStatus('running');
    try {
      const response = await fetch('/api/permissions/migrate', {
        method: 'POST'
      });
      
      if (response.ok) {
        setMigrationStatus('completed');
        loadDashboardData(); // Refresh data
      } else {
        setMigrationStatus('error');
      }
    } catch (error) {
      setMigrationStatus('error');
    }
  };

  const clearCache = async () => {
    try {
      PermissionCache.invalidateAll();
      // Could also call API endpoint
      await fetch('/api/permissions/cache/clear', { method: 'POST' });
      loadDashboardData();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const exportReport = async () => {
    try {
      const report = await PermissionAnalytics.generatePermissionReport({
        timeRange: selectedTimeRange,
        includeUsage: true
      });
      
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `permission-report-${selectedTimeRange}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permission Management</h1>
          <p className="text-gray-600">Manage and monitor system permissions</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange} onValueChange={(value: any) => setSelectedTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Migration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Permission System Migration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Migrate from the old JSON-based permission system to the new database-driven system.
                </p>
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={runMigration} 
                    disabled={migrationStatus === 'running'}
                    className="flex-1"
                  >
                    {migrationStatus === 'running' && <Zap className="h-4 w-4 mr-2 animate-spin" />}
                    Run Migration
                  </Button>
                </div>
                
                {migrationStatus === 'completed' && (
                  <div className="p-3 bg-green-100 text-green-800 rounded-lg">
                    ✅ Migration completed successfully
                  </div>
                )}
                
                {migrationStatus === 'error' && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-lg">
                    ❌ Migration failed. Check logs for details.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Permissions</p>
                  <p className="text-2xl font-bold">{stats.totalPermissions}</p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold">{stats.activeUsers}</p>
                </div>
                <Users className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
                  <p className="text-2xl font-bold">{(stats.cacheHitRate * 100).toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recent Grants</p>
                  <p className="text-2xl font-bold">{stats.recentGrants}</p>
                </div>
                <Activity className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Permission Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Most Used Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {usageData.slice(0, 10).map((usage, index) => (
                    <div key={usage.permission_name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                        <span className="font-medium">{usage.permission_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{usage.usage_count} uses</Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(usage.last_used_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={clearCache} variant="outline" className="w-full justify-start">
                  <Zap className="h-4 w-4 mr-2" />
                  Clear Permission Cache
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="h-4 w-4 mr-2" />
                  Cleanup Expired Permissions
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Run Permission Audit
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Generate Usage Report
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">98.5%</div>
                  <div className="text-sm text-green-700">Permission Check Success Rate</div>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">15ms</div>
                  <div className="text-sm text-blue-700">Average Response Time</div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats?.cacheHitRate ? (stats.cacheHitRate * 100).toFixed(1) : 0}%</div>
                  <div className="text-sm text-purple-700">Cache Hit Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionManagementTab />
        </TabsContent>

        <TabsContent value="users">
          <UserPermissionTab />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab timeRange={selectedTimeRange} />
        </TabsContent>

        <TabsContent value="settings">
          <PermissionSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// 📋 PERMISSION MANAGEMENT TAB
// ============================================

function PermissionManagementTab() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await fetch('/api/permissions');
      const result = await response.json();
      
      if (result.success) {
        setPermissions(result.data.permissions);
        setCategories(result.data.permissionsByCategory);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const filteredCategories = Object.entries(categories).reduce((acc, [category, perms]) => {
    const filtered = perms.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search permissions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button>
          <Shield className="h-4 w-4 mr-2" />
          Add Permission
        </Button>
      </div>

      <div className="grid gap-6">
        {Object.entries(filteredCategories).map(([category, perms]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize">{category.replace('_', ' ')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {perms.map((permission) => (
                  <div key={permission.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{permission.name}</h4>
                      <Badge variant={permission.is_active ? 'default' : 'secondary'}>
                        {permission.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">{permission.description}</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Usage</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 👥 USER PERMISSION TAB
// ============================================

function UserPermissionTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadUserPermissions = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/permissions`);
      const result = await response.json();
      
      if (result.success) {
        setUserPermissions(result.data);
      }
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    }
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    loadUserPermissions(user.id);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedUser?.id === user.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Badge variant="outline">{user.role}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Permissions */}
      <div className="lg:col-span-2">
        {selectedUser ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Permissions for {selectedUser.name}</CardTitle>
                <Button size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userPermissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No permissions assigned</p>
                ) : (
                  userPermissions.map((perm) => (
                    <div key={perm.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{perm.permission_name}</h4>
                        <p className="text-sm text-gray-600">
                          Source: {perm.source} • Granted: {new Date(perm.granted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">Remove</Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a user to view their permissions</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================
// 📊 ANALYTICS TAB
// ============================================

function AnalyticsTab({ timeRange }: { timeRange: '7d' | '30d' | '90d' }) {
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      // This would call the analytics API
      const mockData = {
        permissionGrants: [
          { date: '2024-01-01', count: 15 },
          { date: '2024-01-02', count: 23 },
          { date: '2024-01-03', count: 18 }
        ],
        topPermissions: [
          { name: 'CREATE_CLUB', usage: 156 },
          { name: 'UPLOAD_FILE', usage: 89 },
          { name: 'CREATE_TASK', usage: 67 }
        ],
        roleDistribution: {
          admin: 2,
          club_leader: 15,
          member: 143
        }
      };
      
      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  if (!analyticsData) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Permission Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Permissions ({timeRange})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.topPermissions.map((perm: any, index: number) => (
                <div key={perm.name} className="flex items-center justify-between">
                  <span className="font-medium">{perm.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(perm.usage / analyticsData.topPermissions[0].usage) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{perm.usage}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analyticsData.roleDistribution).map(([role, count]: [string, any]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="capitalize font-medium">{role.replace('_', ' ')}</span>
                  <Badge variant="outline">{count} users</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grant Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Grants Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2 pt-4">
            {analyticsData.permissionGrants.map((grant: any) => (
              <div key={grant.date} className="flex-1 flex flex-col items-center">
                <div 
                  className="bg-blue-500 w-full rounded-t"
                  style={{ height: `${(grant.count / 25) * 100}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-gray-500 mt-2">
                  {new Date(grant.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// ⚙️ SETTINGS TAB
// ============================================

function PermissionSettingsTab() {
  const [settings, setSettings] = useState({
    cacheEnabled: true,
    cacheDuration: 300,
    auditLogging: true,
    autoCleanup: true,
    cleanupInterval: 24
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/permissions/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        // Show success message
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cache Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="font-medium">Enable Caching</label>
            <input
              type="checkbox"
              checked={settings.cacheEnabled}
              onChange={(e) => handleSettingChange('cacheEnabled', e.target.checked)}
              className="rounded"
            />
          </div>
          
          <div>
            <label className="block font-medium mb-2">Cache Duration (seconds)</label>
            <Input
              type="number"
              value={settings.cacheDuration}
              onChange={(e) => handleSettingChange('cacheDuration', parseInt(e.target.value))}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit & Cleanup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="font-medium">Enable Audit Logging</label>
            <input
              type="checkbox"
              checked={settings.auditLogging}
              onChange={(e) => handleSettingChange('auditLogging', e.target.checked)}
              className="rounded"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="font-medium">Auto Cleanup</label>
            <input
              type="checkbox"
              checked={settings.autoCleanup}
              onChange={(e) => handleSettingChange('autoCleanup', e.target.checked)}
              className="rounded"
            />
          </div>
          
          <div>
            <label className="block font-medium mb-2">Cleanup Interval (hours)</label>
            <Input
              type="number"
              value={settings.cleanupInterval}
              onChange={(e) => handleSettingChange('cleanupInterval', parseInt(e.target.value))}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveSettings} className="w-full">
        Save Settings
      </Button>
    </div>
  );
}