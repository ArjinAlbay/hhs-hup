import { useState, useCallback } from 'react';
import { PermissionService } from '@/lib/permissions';

export function usePermissionAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantPermission = useCallback(async (
    userId: string,
    permissionName: string,
    grantedBy: string,
    options?: { expiresAt?: string; context?: any }
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const success = await PermissionService.grantPermission(userId, permissionName, grantedBy, options);
      if (!success) throw new Error('Failed to grant permission');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const revokePermission = useCallback(async (userId: string, permissionName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const success = await PermissionService.revokePermission(userId, permissionName);
      if (!success) throw new Error('Failed to revoke permission');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserPermissions = useCallback(async (
    userId: string,
    permissionNames: string[],
    grantedBy: string
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const success = await PermissionService.updateUserPermissions(userId, permissionNames, grantedBy);
      if (!success) throw new Error('Failed to update permissions');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPermissionStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      return await PermissionService.getPermissionStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    grantPermission,
    revokePermission,
    updateUserPermissions,
    getPermissionStats,
    loading,
    error,
    clearError: () => setError(null)
  };
}