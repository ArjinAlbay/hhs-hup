'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Plus, Shield, Users } from 'lucide-react';
import { usePermissionAdmin } from '@/hooks/usePermissionAdmin';
import PermissionTransfer from './PermissionTransfer';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

interface UserPermission {
  id: string;
  user_id: string;
  permission_id: string;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  context?: any;
  permission: Permission;
}

export default function PermissionManager() {
  const { user: currentUser } = useAuth();
  const { grantPermission, revokePermission, loading: adminLoading } = usePermissionAdmin();
  
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddPermission, setShowAddPermission] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/permissions');
      const result = await response.json();
      if (result.success) {
        setPermissions(result.data.permissions);
      }
    } catch (error) {
      console.error('Permissions fetch error:', error);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/permissions`);
      const result = await response.json();
      if (result.success) {
        setUserPermissions(result.data);
      }
    } catch (error) {
      console.error('User permissions fetch error:', error);
    }
    setIsLoading(false);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    fetchUserPermissions(user.id);
  };

  const handleGrantPermission = async (permissionName: string) => {
    if (!selectedUser || !currentUser) return;

    try {
      const success = await grantPermission(
        selectedUser.id, 
        permissionName, 
        currentUser.id
      );
      
      if (success) {
        fetchUserPermissions(selectedUser.id);
        setShowAddPermission(false);
      }
    } catch (error) {
      console.error('Grant permission error:', error);
    }
  };

  const handleRevokePermission = async (permissionName: string) => {
    if (!selectedUser) return;

    try {
      const success = await revokePermission(selectedUser.id, permissionName);
      if (success) {
        fetchUserPermissions(selectedUser.id);
      }
    } catch (error) {
      console.error('Revoke permission error:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPermissionsByCategory = () => {
    const categories = permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = [];
      }
      acc[permission.category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);

    return categories;
  };

  const getCategoryDisplayName = (category: string) => {
    const names = {
      'user_management': '👥 Kullanıcı Yönetimi',
      'club_management': '🏢 Kulüp Yönetimi',
      'task_management': '📝 Görev Yönetimi',
      'meeting_management': '📅 Toplantı Yönetimi',
      'file_management': '📁 Dosya Yönetimi',
      'system': '⚙️ Sistem'
    };
    return names[category as keyof typeof names] || category;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'club_leader': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const userHasPermission = (permissionName: string) => {
    return userPermissions.some(up => up.permission.name === permissionName);
  };

  const availablePermissions = permissions.filter(p => 
    !userHasPermission(p.name)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Kullanıcı Listesi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Kullanıcılar ({filteredUsers.length})
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Badge className={getRoleColor(user.role)}>
                    {user.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kullanıcı Yetkileri */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              {selectedUser ? `${selectedUser.name} - Yetkiler` : 'Kullanıcı Seçin'}
            </CardTitle>
            {selectedUser && (
              <Dialog open={showAddPermission} onOpenChange={setShowAddPermission}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={adminLoading}>
                    <Plus className="mr-2 h-4 w-4" />
                    Yetki Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Yetki Ekle - {selectedUser.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {Object.entries(getPermissionsByCategory()).map(([category, perms]) => {
                      const availablePerms = perms.filter(p => !userHasPermission(p.name));
                      if (availablePerms.length === 0) return null;

                      return (
                        <div key={category}>
                          <h4 className="font-medium mb-2">{getCategoryDisplayName(category)}</h4>
                          <div className="space-y-2">
                            {availablePerms.map((permission) => (
                              <div
                                key={permission.id}
                                className="flex items-center justify-between p-2 border rounded"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{permission.name}</p>
                                  <p className="text-xs text-gray-500">{permission.description}</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleGrantPermission(permission.name)}
                                  disabled={adminLoading}
                                >
                                  Ekle
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {availablePermissions.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Eklenebilecek yetki yok</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {!selectedUser ? (
            <div className="text-center py-12">
              <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Yetkilerini görmek için bir kullanıcı seçin</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Yetkiler yükleniyor...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Permissions List */}
              <div>
                <h4 className="font-medium mb-3">Mevcut Yetkiler ({userPermissions.length})</h4>
                {userPermissions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Bu kullanıcının özel yetkisi yok</p>
                ) : (
                  <div className="space-y-2">
                    {userPermissions.map((perm) => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{perm.permission.name}</p>
                          <p className="text-xs text-gray-500">{perm.permission.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {perm.permission.category}
                            </Badge>
                            {perm.expires_at && (
                              <Badge variant="secondary" className="text-xs">
                                Geçici: {new Date(perm.expires_at).toLocaleDateString('tr-TR')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevokePermission(perm.permission.name)}
                          disabled={adminLoading}
                        >
                          Kaldır
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Role-based permissions info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Rol Bazlı Yetkiler</h5>
                <p className="text-sm text-blue-700">
                  Bu kullanıcı <Badge className={getRoleColor(selectedUser.role)}>{selectedUser.role}</Badge> rolünden 
                  dolayı otomatik yetkilerle de sahiptir. Yukarıdaki liste sadece ek verilen özel yetkilerdir.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}