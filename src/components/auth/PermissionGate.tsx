import { ReactNode, useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  context?: any;
  fallback?: ReactNode;
  roles?: ('admin' | 'club_leader' | 'member')[];
  loading?: ReactNode;
}

export function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  context,
  fallback = null,
  roles,
  loading: loadingComponent = <div>Loading...</div>
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, user, loading } = usePermissions();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setHasAccess(false);
        return;
      }

      // Role-based check
      if (roles && !roles.includes(user.role)) {
        setHasAccess(false);
        return;
      }

      // Permission-based check
      if (permission) {
        const result = await hasPermission(permission, context);
        setHasAccess(result);
        return;
      }

      if (permissions) {
        const result = requireAll
          ? await hasAllPermissions(permissions, context)
          : await hasAnyPermission(permissions, context);
        setHasAccess(result);
        return;
      }

      // If no specific checks, allow access
      setHasAccess(true);
    };

    if (!loading) {
      checkAccess();
    }
  }, [user, roles, permission, permissions, requireAll, context, loading, hasPermission, hasAnyPermission, hasAllPermissions]);

  if (loading || hasAccess === null) {
    return <>{loadingComponent}</>;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}