// src/hooks/usePermissions-new.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { PermissionService, Permission, UserPermission } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user permissions and all available permissions
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        const [userPerms, allPerms] = await Promise.all([
          PermissionService.getUserEffectivePermissions(user.id),
          PermissionService.getAllPermissions()
        ]);
        
        setUserPermissions(userPerms);
        setAllPermissions(allPerms);
      } catch (error) {
        console.error('Failed to load permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user?.id]);

  // Check if user has specific permission
  const hasPermission = useCallback(async (permissionName: string, context?: any) => {
    if (!user?.id) return false;
    return PermissionService.hasPermission(user.id, permissionName, context);
  }, [user?.id]);

  // Check multiple permissions (OR logic)
  const hasAnyPermission = useCallback(async (permissionNames: string[], context?: any) => {
    if (!user?.id) return false;
    
    for (const permission of permissionNames) {
      if (await hasPermission(permission, context)) {
        return true;
      }
    }
    return false;
  }, [user?.id, hasPermission]);

  // Check multiple permissions (AND logic)
  const hasAllPermissions = useCallback(async (permissionNames: string[], context?: any) => {
    if (!user?.id) return false;
    
    for (const permission of permissionNames) {
      if (!(await hasPermission(permission, context))) {
        return false;
      }
    }
    return true;
  }, [user?.id, hasPermission]);

  // Get permissions by category
  const getPermissionsByCategory = useCallback(() => {
    return allPermissions.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [allPermissions]);

  // Refresh permissions (for after grant/revoke operations)
  const refreshPermissions = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const userPerms = await PermissionService.getUserEffectivePermissions(user.id);
      setUserPermissions(userPerms);
    } catch (error) {
      console.error('Failed to refresh permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Data
    userPermissions,
    allPermissions,
    permissionsByCategory: getPermissionsByCategory(),
    
    // Utils
    refreshPermissions,
    loading,
    isAuthenticated: !!user,
    user,
    
    // Quick role checks
    isAdmin: user?.role === 'admin',
    isClubLeader: user?.role === 'club_leader',
    isMember: user?.role === 'member'
  };
}