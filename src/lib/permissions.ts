// ============================================
// 🔄 NEW PERMISSION SERVICE - Database Driven
// ============================================

// src/lib/permissions-new.ts
import { createClient } from '@/utils/supabase/client'

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

export interface UserPermission {
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

export class PermissionService {
  private static getClient() {
    return createClient();
  }

  // 📋 Get all available permissions
  static async getAllPermissions(): Promise<Permission[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // 🎯 Get permissions by category
  static async getPermissionsByCategory(): Promise<Record<string, Permission[]>> {
    const permissions = await this.getAllPermissions();
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }

  // 👤 Get user's effective permissions (role + individual)
  static async getUserEffectivePermissions(userId: string): Promise<UserPermission[]> {
    const supabase = this.getClient();
    const { data, error } = await supabase
      .from('user_effective_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  // 🔍 Check if user has specific permission
  static async hasPermission(userId: string, permissionName: string, context?: any): Promise<boolean> {
    const supabase = this.getClient();
    
    // Check if user is admin first
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (user?.role === 'admin') return true;

    // Check effective permissions
    const { data, error } = await supabase
      .from('user_effective_permissions')
      .select('permission_name')
      .eq('user_id', userId)
      .eq('permission_name', permissionName);

    if (error) return false;

    // If no context required, return true if permission exists
    if (!context) return (data?.length || 0) > 0;

    // Context-based check (e.g., club-specific permissions)
    if (context.clubId) {
      // Additional logic for club-specific permissions
      const { data: contextData } = await supabase
        .from('user_permissions')
        .select('context')
        .eq('user_id', userId)
        .eq('permission_id', (await supabase
          .from('permissions')
          .select('id')
          .eq('name', permissionName)
          .single()
        ).data?.id);

      return contextData?.some(p => 
        !p.context || 
        !p.context.clubId || 
        p.context.clubId === context.clubId
      ) || false;
    }

    return (data?.length || 0) > 0;
  }

  // ➕ Grant permission to user
  static async grantPermission(
    userId: string,
    permissionName: string,
    grantedBy: string,
    options?: {
      expiresAt?: string;
      context?: any;
    }
  ): Promise<boolean> {
    const supabase = this.getClient();

    // Get permission ID
    const { data: permission } = await supabase
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (!permission) return false;

    const { error } = await supabase
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permission.id,
        granted_by: grantedBy,
        expires_at: options?.expiresAt,
        context: options?.context
      });

    return !error;
  }

  // ➖ Revoke permission from user
  static async revokePermission(userId: string, permissionName: string): Promise<boolean> {
    const supabase = this.getClient();

    const { data: permission } = await supabase
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (!permission) return false;

    const { error } = await supabase
      .from('user_permissions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('permission_id', permission.id);

    return !error;
  }

  // 🔄 Bulk update user permissions
  static async updateUserPermissions(
    userId: string,
    permissionNames: string[],
    grantedBy: string
  ): Promise<boolean> {
    const supabase = this.getClient();

    // Deactivate all current permissions
    await supabase
      .from('user_permissions')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Add new permissions
    for (const permissionName of permissionNames) {
      const success = await this.grantPermission(userId, permissionName, grantedBy);
      if (!success) return false;
    }

    return true;
  }

  // 📊 Get permission statistics
  static async getPermissionStats(): Promise<{
    totalPermissions: number;
    activeUsers: number;
    permissionsByCategory: Record<string, number>;
  }> {
    const supabase = this.getClient();

    const [permissionsData, usersData] = await Promise.all([
      supabase.from('permissions').select('category').eq('is_active', true),
      supabase.from('users').select('id').eq('is_active', true)
    ]);

    const permissionsByCategory = (permissionsData.data || []).reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPermissions: permissionsData.data?.length || 0,
      activeUsers: usersData.data?.length || 0,
      permissionsByCategory
    };
  }
}

// ============================================
// 🔄 MIGRATION UTILITY
// ============================================

export class PermissionMigration {
  static async migrateFromOldSystem(): Promise<void> {
    const supabase = createClient();
    
    console.log('🔄 Starting permission migration...');

    // Get users with old JSON permissions
    const { data: users } = await supabase
      .from('users')
      .select('id, permissions')
      .not('permissions', 'is', null);

    if (!users) return;

    for (const user of users) {
      if (!user.permissions) continue;

      const oldPermissions = Array.isArray(user.permissions) 
        ? user.permissions.map(p => typeof p === 'string' ? p : p.name)
        : [];

      for (const permName of oldPermissions) {
        await PermissionService.grantPermission(user.id, permName, user.id);
      }
    }

    console.log(`✅ Migrated permissions for ${users.length} users`);
  }

  static async validateMigration(): Promise<boolean> {
    const supabase = createClient();
    
    // Compare old vs new system for a sample user
    const { data: sampleUser } = await supabase
      .from('users')
      .select('id, permissions')
      .not('permissions', 'is', null)
      .limit(1)
      .single();

    if (!sampleUser) return true;

    const oldPermissions = Array.isArray(sampleUser.permissions) 
      ? sampleUser.permissions.map(p => typeof p === 'string' ? p : p.name)
      : [];

    const newPermissions = await PermissionService.getUserEffectivePermissions(sampleUser.id);
    const newPermissionNames = newPermissions.map(p => p.permission?.name);

    const missing = oldPermissions.filter(p => !newPermissionNames.includes(p));
    
    if (missing.length > 0) {
      console.error('❌ Migration validation failed. Missing permissions:', missing);
      return false;
    }

    console.log('✅ Migration validation passed');
    return true;
  }
}