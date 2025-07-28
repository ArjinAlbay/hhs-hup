
// src/lib/permissions-advanced.ts
import { createClient } from '@/utils/supabase/client';
import { PermissionService } from './permissions';
import { NextRequest } from 'next/server';

export interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  target_role?: 'admin' | 'club_leader' | 'member';

  
}



export interface PermissionRule {
  id: string;
  name: string;
  condition: string; // SQL-like condition
  action: 'GRANT' | 'REVOKE';
  permission_name: string;
  priority: number;
}

export class AdvancedPermissionService extends PermissionService {
  // ⏰ Temporary Permissions
  static async grantTemporaryPermission(
    userId: string,
    permissionName: string,
    durationMinutes: number,
    grantedBy: string,
    reason?: string
  ): Promise<boolean> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);
    const success = await this.grantPermission(userId, permissionName, grantedBy, { expiresAt: expiresAt.toISOString() });
    if (success && reason) {
      // Log the temporary permission grant
      const supabase = createClient();
      await supabase
        .from('permission_audit_log')
        .insert({
          user_id: userId,
          permission_name: permissionName,
          action: 'GRANT_TEMPORARY',
          granted_by: grantedBy,
          expires_at: expiresAt.toISOString(),
          reason: reason
        });
    }
    return success;
  }

  static async cleanupExpiredPermissions(): Promise<number> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, permissions')
      .eq('is_active', true);
    if (error) throw error;
    let count = 0;
    for (const user of data || []) {
      let permissions = user.permissions || [];
      const now = new Date();
      const updatedPermissions = permissions.filter((p: any) => !p.expires_at || new Date(p.expires_at) > now);
      if (updatedPermissions.length !== permissions.length) {
        await supabase.from('users').update({ permissions: updatedPermissions }).eq('id', user.id);
        count++;
      }
    }
    return count;
  }

  static async trackPermissionUsage(userId: string, permissionName: string, context?: any): Promise<void> {
    const supabase = createClient();
    // Update or insert usage stats
    const { error } = await supabase
      .from('permission_usage_stats')
      .upsert({
        user_id: userId,
        permission_name: permissionName,
        context: context || null,
        usage_count: 1,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,permission_name',
        ignoreDuplicates: false
      });
    if (error) {
      // If upsert fails, try manual increment
      await supabase.rpc('increment_permission_usage', {
        p_user_id: userId,
        p_permission_name: permissionName
      });
    }
  }
  // 📋 Permission Templates (For quick role setup)
  static async createPermissionTemplate(template: Omit<PermissionTemplate, 'id'>): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('permission_templates')
      .insert(template)
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  static async applyPermissionTemplate(userId: string, templateId: string, grantedBy: string): Promise<boolean> {
    const supabase = createClient();
    const { data: template } = await supabase
      .from('permission_templates')
      .select('permissions')
      .eq('id', templateId)
      .single();
    if (!template) return false;
    return this.updateUserPermissions(userId, template.permissions, grantedBy);
  }

  // 🔄 Conditional Permissions (Dynamic rules)
  static async evaluatePermissionRules(userId: string): Promise<void> {
    const supabase = createClient();
    // Get all active rules
    const { data: rules } = await supabase
      .from('permission_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });
    if (!rules) return;
    for (const rule of rules) {
      // TODO: Implement rule condition evaluation logic or remove this call if not needed
      // const shouldApply = await this.evaluateRuleCondition(userId, rule.condition);
      // For now, skip rule evaluation
      const shouldApply = false;
      if (shouldApply) {
        if (rule.action === 'GRANT') {
          await this.grantPermission(userId, rule.permission_name, 'system');
        } else {
          await this.revokePermission(userId, rule.permission_name);
        }
      }
    }
  }

  // 📊 Permission Analytics
  static async getPermissionAnalytics(timeRange: '7d' | '30d' | '90d' = '30d') {
    const supabase = createClient();
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const [grantedData, revokedData, mostUsedData] = await Promise.all([
      // Permissions granted
      supabase
        .from('user_permissions')
        .select('permission_id, granted_at, permissions(name)')
        .gte('granted_at', startDate.toISOString()),
      // Permissions revoked
      supabase
        .from('user_permissions')
        .select('permission_id, updated_at, permissions(name)')
        .eq('is_active', false)
        .gte('updated_at', startDate.toISOString()),
      // Most frequently checked permissions
      supabase
        .from('permission_check_logs')
        .select('permission_name, count')
        .gte('created_at', startDate.toISOString())
        .order('count', { ascending: false })
        .limit(10)
    ]);
    return {
      granted: grantedData.data || [],
      revoked: revokedData.data || [],
      mostUsed: mostUsedData.data || []
    };
  }

  // 🔒 Permission Inheritance (For hierarchical organizations)
  static async setupPermissionInheritance(
    parentUserId: string,
    childUserId: string,
    inheritanceType: 'full' | 'partial' | 'club_specific',
    context?: { clubId?: string }
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('permission_inheritance')
        .insert({
          parent_user_id: parentUserId,
          child_user_id: childUserId,
          inheritance_type: inheritanceType,
          context: context || null,
          is_active: true
        });
      if (error) throw error;
      // Apply inherited permissions
      await this.applyInheritedPermissions(childUserId);
      return true;
    } catch {
      return false;
    }
  }

  private static async applyInheritedPermissions(userId: string): Promise<void> {
    const supabase = createClient();
    // Get inheritance rules for this user
    const { data: inheritances } = await supabase
      .from('permission_inheritance')
      .select(`
        parent_user_id,
        inheritance_type,
        context,
        parent:users!permission_inheritance_parent_user_id_fkey(
          user_permissions(
            id,
            permission_id,
            permissions(name)
          )
        )
      `)
      .eq('child_user_id', userId)
      .eq('is_active', true);
    if (!inheritances) return;
    for (const inheritance of inheritances) {
      // Flatten user_permissions to get permission names
      const parentArr = Array.isArray(inheritance.parent) ? inheritance.parent : [inheritance.parent];
      let parentPermissions: Array<{ name: string }> = [];
      for (const parent of parentArr) {
        if (parent && Array.isArray(parent.user_permissions)) {
          for (const up of parent.user_permissions) {
            if (Array.isArray(up.permissions)) {
              for (const perm of up.permissions) {
                if (perm && typeof perm.name === 'string') {
                  parentPermissions.push({ name: perm.name });
                }
              }
            }
          }
        }
      }
      for (const perm of parentPermissions) {
        if (inheritance.inheritance_type === 'full') {
          await this.grantPermission(userId, perm.name, 'inherited');
        } else if (inheritance.inheritance_type === 'club_specific' && inheritance.context?.clubId) {
          await this.grantPermission(
            userId,
            perm.name,
            'inherited'
          );
        }
      }
    }
  }

  // 🎯 Smart Permission Suggestions

}

// ============================================
// 🎯 PERMISSION CACHING SYSTEM
// ============================================

export class PermissionCache {
  private static cache = new Map<string, { 
    permissions: string[], 
    expires: number,
    version: number 
  }>();
  
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  static async getUserPermissions(userId: string, forceRefresh = false): Promise<string[]> {
    const cacheKey = `permissions:${userId}`;
    const cached = this.cache.get(cacheKey);
    
    if (!forceRefresh && cached && cached.expires > Date.now()) {
      return cached.permissions;
    }
    
    // Fetch fresh permissions
    const permissions = await AdvancedPermissionService.getUserEffectivePermissions(userId);
    const permissionNames = permissions.map((p: { permission: { name: string } }) => p.permission.name);

    
    // Cache the results
    this.cache.set(cacheKey, {
      permissions: permissionNames,
      expires: Date.now() + this.CACHE_DURATION,
      version: Date.now()
    });
    
    return permissionNames;
  }
  
  static invalidateUser(userId: string): void {
    this.cache.delete(`permissions:${userId}`);
  }
  
  static invalidateAll(): void {
    this.cache.clear();
  }
  
  static getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0.85 // Would need actual tracking
    };
  }
}

// ============================================
// 🔐 MIDDLEWARE ENHANCEMENTS
// ============================================

export function withAdvancedPermissions(options: {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  context?: (request: NextRequest) => any;
  onUnauthorized?: (request: NextRequest) => Response;
  trackUsage?: boolean;
}) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(request: NextRequest, ...args: any[]) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return options.onUnauthorized?.(request) || 
            new Response('Unauthorized', { status: 401 });
        }
        
        const context = options.context?.(request);
        
        // Check permissions
        if (options.permission) {
          const hasPermission = await AdvancedPermissionService.hasPermission(
            user.id, 
            options.permission, 
            context
          );
          
          if (!hasPermission) {
            return new Response('Forbidden', { status: 403 });
          }
          
          // Track usage
          if (options.trackUsage) {
            await AdvancedPermissionService.trackPermissionUsage(
              user.id, 
              options.permission, 
              context
            );
          }
        }
        
        if (options.permissions) {
          const hasRequired = options.requireAll
            ? await Promise.all(options.permissions.map(p => 
                AdvancedPermissionService.hasPermission(user.id, p, context)
              )).then(results => results.every(Boolean))
            : await Promise.all(options.permissions.map(p => 
                AdvancedPermissionService.hasPermission(user.id, p, context)
              )).then(results => results.some(Boolean));
          
          if (!hasRequired) {
            return new Response('Forbidden', { status: 403 });
          }
        }
        
        return originalMethod.call(this, request, ...args);
      } catch (error) {
        return new Response('Server Error', { status: 500 });
      }
    };
    
    return descriptor;
  };
}

// ============================================
// 📊 ANALYTICS & REPORTING
// ============================================

export class PermissionAnalytics {
  static async generatePermissionReport(options: {
    userId?: string;
    timeRange?: '7d' | '30d' | '90d';
    includeUsage?: boolean;
  } = {}) {
    const supabase = createClient();
    
    const report = {
      summary: {
        totalPermissions: 0,
        activeUsers: 0,
        recentGrants: 0,
        recentRevokes: 0
      },
      permissionDistribution: {} as Record<string, number>,
      roleBreakdown: {} as Record<string, number>,
      usage: [] as any[],
      recommendations: [] as any[]
    };
    
    // Get summary data
    const [permissionsCount, usersCount] = await Promise.all([
      supabase.from('permissions').select('id', { count: 'exact' }),
      supabase.from('users').select('id', { count: 'exact' }).eq('is_active', true)
    ]);
    
    report.summary.totalPermissions = permissionsCount.count || 0;
    report.summary.activeUsers = usersCount.count || 0;
    
    // Permission distribution by category
    const { data: permissionDist } = await supabase
      .from('permissions')
      .select('category')
      .eq('is_active', true);
    report.permissionDistribution = (permissionDist || []).reduce((acc: Record<string, number>, p: { category: string }) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Role breakdown
    const { data: roleData } = await supabase
      .from('users')
      .select('role')
      .eq('is_active', true);
    report.roleBreakdown = (roleData || []).reduce((acc: Record<string, number>, u: { role: string }) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Usage data (if requested)
    if (options.includeUsage) {
      const { data: usageData } = await supabase
        .from('permission_usage_stats')
        .select('permission_name, usage_count, last_used_at')
        .order('usage_count', { ascending: false })
        .limit(20);
      report.usage = usageData || [];
    }
    
    return report;
  }
  
  static async getUnusedPermissions(daysSinceLastUse = 30): Promise<string[]> {
    const supabase = createClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastUse);
    // Get all permissions
    const { data: allPerms } = await supabase
      .from('permissions')
      .select('name');
    // Get used permissions
    const { data: usedPerms } = await supabase
      .from('permission_usage_stats')
      .select('permission_name, last_used_at');
    const usedSet = new Set(
      (usedPerms || [])
        .filter((p: { last_used_at: string }) => new Date(p.last_used_at) >= cutoffDate)
        .map((p: { permission_name: string }) => p.permission_name)
    );
    return (allPerms || [])
      .map((p: { name: string }) => p.name)
      .filter((name: string) => !usedSet.has(name));
  }
}

// ============================================
// 🔄 BACKGROUND JOBS
// ============================================

export class PermissionJobs {
  // Run cleanup tasks
  static async runDailyMaintenance(): Promise<{
    expiredPermissionsRemoved: number;
    cacheCleared: boolean;
    rulesEvaluated: number;
  }> {
    const results = {
      expiredPermissionsRemoved: 0,
      cacheCleared: false,
      rulesEvaluated: 0
    };
    
    try {
      // Clean expired permissions
      results.expiredPermissionsRemoved = await AdvancedPermissionService.cleanupExpiredPermissions();
      
      // Clear permission cache
      PermissionCache.invalidateAll();
      results.cacheCleared = true;
      
      // Evaluate permission rules for all users
      const supabase = createClient();
      const { data: activeUsers } = await supabase
        .from('users')
        .select('id')
        .eq('is_active', true);
      
      if (activeUsers) {
        for (const user of activeUsers) {
          await AdvancedPermissionService.evaluatePermissionRules(user.id);
          results.rulesEvaluated++;
        }
      }
      
    } catch (error) {
      console.error('Permission maintenance job failed:', error);
    }
    
    return results;
  }
}