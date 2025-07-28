import { NextRequest, NextResponse } from "next/server";

// src/lib/api-cache.ts - API Response Caching System
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
  ttl: number; // Cache duration in milliseconds
  tags: string[]; // Cache tags for invalidation
  keyGenerator?: (request: Request, user?: any) => string;
}

// In-memory cache (use Redis in production)
const cache = new Map<string, CacheEntry<any>>();
const tagMap = new Map<string, Set<string>>(); // tag -> set of cache keys

// Default cache configurations
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Short-lived caches for frequently changing data
  '/api/notifications': {
    ttl: 30 * 1000, // 30 seconds
    tags: ['notifications', 'user-specific']
  },
  
  // Medium-lived caches for moderate changes
  '/api/clubs': {
    ttl: 5 * 60 * 1000, // 5 minutes
    tags: ['clubs', 'public-data']
  },
  
  '/api/tasks': {
    ttl: 2 * 60 * 1000, // 2 minutes
    tags: ['tasks', 'user-specific']
  },
  
  '/api/meetings': {
    ttl: 3 * 60 * 1000, // 3 minutes
    tags: ['meetings', 'club-specific']
  },
  
  // Long-lived caches for rarely changing data
  '/api/admin/users': {
    ttl: 10 * 60 * 1000, // 10 minutes
    tags: ['users', 'admin-data']
  },
  
  '/api/files': {
    ttl: 5 * 60 * 1000, // 5 minutes
    tags: ['files', 'club-specific']
  }
};

export class ApiCache {
  static generateKey(
    endpoint: string, 
    request: Request, 
    user?: any,
    customGenerator?: (request: Request, user?: any) => string
  ): string {
    if (customGenerator) {
      return `${endpoint}:${customGenerator(request, user)}`;
    }
    
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const userId = user?.id || 'anonymous';
    const userRole = user?.role || 'guest';
    
    return `${endpoint}:${userId}:${userRole}:${searchParams}`;
  }
  
  static set<T>(key: string, data: T, config: CacheConfig): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl
    };
    
    cache.set(key, entry);
    
    // Update tag mappings
    config.tags.forEach(tag => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, new Set());
      }
      tagMap.get(tag)!.add(key);
    });
  }
  
  static get<T>(key: string): T | null {
    const entry = cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  static invalidate(key: string): void {
    cache.delete(key);
    
    // Remove from tag mappings
    tagMap.forEach((keys, tag) => {
      keys.delete(key);
      if (keys.size === 0) {
        tagMap.delete(tag);
      }
    });
  }
  
  static invalidateByTag(tag: string): number {
    const keys = tagMap.get(tag);
    if (!keys) return 0;
    
    let count = 0;
    keys.forEach(key => {
      cache.delete(key);
      count++;
    });
    
    tagMap.delete(tag);
    
    // Clean up other tag mappings
    tagMap.forEach((otherKeys, otherTag) => {
      keys.forEach(key => otherKeys.delete(key));
      if (otherKeys.size === 0) {
        tagMap.delete(otherTag);
      }
    });
    
    return count;
  }
  
  static invalidateByPattern(pattern: RegExp): number {
    let count = 0;
    
    cache.forEach((_, key) => {
      if (pattern.test(key)) {
        this.invalidate(key);
        count++;
      }
    });
    
    return count;
  }
  
  static clear(): void {
    cache.clear();
    tagMap.clear();
  }
  
  static getStats() {
    return {
      totalEntries: cache.size,
      totalTags: tagMap.size,
      memoryUsage: JSON.stringify([...cache.entries()]).length, // Rough estimate
      oldestEntry: Math.min(...Array.from(cache.values()).map(e => e.timestamp)),
      newestEntry: Math.max(...Array.from(cache.values()).map(e => e.timestamp))
    };
  }
}

// Cache middleware
export function withCache(
  handler: (request: NextRequest, user: any, ...args: any[]) => Promise<NextResponse>,
  options: {
    endpoint: string;
    customConfig?: Partial<CacheConfig>;
    skipCache?: (request: NextRequest, user?: any) => boolean;
    skipCacheOnMutation?: boolean;
  }
) {
  return async (request: NextRequest, user: any, ...args: any[]): Promise<NextResponse> => {
    const config = {
      ...CACHE_CONFIGS[options.endpoint],
      ...options.customConfig
    };
    
    // Skip cache for mutations by default
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    if (options.skipCacheOnMutation !== false && isMutation) {
      const response = await handler(request, user, ...args);
      
      // Invalidate related caches after successful mutations
      if (response.status >= 200 && response.status < 300) {
        config.tags.forEach(tag => {
          ApiCache.invalidateByTag(tag);
        });
      }
      
      return response;
    }
    
    // Skip cache if custom condition is met
    if (options.skipCache && options.skipCache(request, user)) {
      return handler(request, user, ...args);
    }
    
    // Generate cache key
    const cacheKey = ApiCache.generateKey(
      options.endpoint,
      request,
      user,
      config.keyGenerator
    );
    
    // Try to get from cache
    const cachedData = ApiCache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache HIT: ${cacheKey}`);
      return NextResponse.json(cachedData, {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `max-age=${Math.floor(config.ttl / 1000)}`
        }
      });
    }
    
    console.log(`Cache MISS: ${cacheKey}`);
    
    // Call handler and cache successful responses
    const response = await handler(request, user, ...args);
    
    // Only cache successful GET responses
    if (request.method === 'GET' && response.status >= 200 && response.status < 300) {
      try {
        const responseData = await response.clone().json();
        ApiCache.set(cacheKey, responseData, config);
        
        // Add cache headers
        response.headers.set('X-Cache', 'MISS');
        response.headers.set('X-Cache-Key', cacheKey);
        response.headers.set('Cache-Control', `max-age=${Math.floor(config.ttl / 1000)}`);
      } catch (error) {
        console.warn('Failed to cache response:', error);
      }
    }
    
    return response;
  };
}

// Cache invalidation helpers
export const CacheInvalidation = {
  // Invalidate user-specific caches
  invalidateUserCache(userId: string) {
    return ApiCache.invalidateByPattern(new RegExp(`:${userId}:`));
  },
  
  // Invalidate club-specific caches
  invalidateClubCache(clubId: string) {
    return ApiCache.invalidateByPattern(new RegExp(`club.*${clubId}`));
  },
  
  // Invalidate all user-specific data
  invalidateAllUserData() {
    return ApiCache.invalidateByTag('user-specific');
  },
  
  // Invalidate public data caches
  invalidatePublicData() {
    return ApiCache.invalidateByTag('public-data');
  },
  
  // Smart invalidation based on operation
  invalidateAfterOperation(operation: string, resourceId?: string) {
    switch (operation) {
      case 'user_created':
      case 'user_updated':
      case 'user_deleted':
        ApiCache.invalidateByTag('users');
        if (resourceId) {
          this.invalidateUserCache(resourceId);
        }
        break;
        
      case 'club_created':
      case 'club_updated':
      case 'club_deleted':
        ApiCache.invalidateByTag('clubs');
        if (resourceId) {
          this.invalidateClubCache(resourceId);
        }
        break;
        
      case 'task_created':
      case 'task_updated':
      case 'task_deleted':
        ApiCache.invalidateByTag('tasks');
        break;
        
      case 'meeting_created':
      case 'meeting_updated':
      case 'meeting_deleted':
        ApiCache.invalidateByTag('meetings');
        break;
        
      case 'file_uploaded':
      case 'file_deleted':
        ApiCache.invalidateByTag('files');
        break;
        
      default:
        console.warn(`Unknown operation for cache invalidation: ${operation}`);
    }
  }
};

