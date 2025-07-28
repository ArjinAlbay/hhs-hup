// src/lib/rate-limiting.ts - API Rate Limiting Middleware
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configurations for different endpoints
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits
  '/api/auth': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 attempts per 15 minutes
  },
  
  // File upload - moderate limits
  '/api/files': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10 // 10 uploads per minute
  },
  
  // General API - generous limits
  '/api/clubs': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60 // 60 requests per minute
  },
  
  '/api/tasks': {
    windowMs: 60 * 1000,
    maxRequests: 100
  },
  
  '/api/meetings': {
    windowMs: 60 * 1000,
    maxRequests: 50
  },
  
  // Default for unspecified endpoints
  'default': {
    windowMs: 60 * 1000,
    maxRequests: 30
  }
};

export function createRateLimiter(configKey: string = 'default') {
  const config = RATE_LIMIT_CONFIGS[configKey] || RATE_LIMIT_CONFIGS['default'];
  
  return async function rateLimitMiddleware(
    request: Request,
    identifier: string // Usually user ID or IP
  ): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    const now = Date.now();
    const key = `${configKey}:${identifier}`;
    
    // Clean up expired entries
    cleanupExpiredEntries(now);
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(key, entry);
      
      return {
        allowed: true,
        resetTime: entry.resetTime,
        remaining: config.maxRequests - 1
      };
    }
    
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        resetTime: entry.resetTime,
        remaining: 0
      };
    }
    
    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      resetTime: entry.resetTime,
      remaining: config.maxRequests - entry.count
    };
  };
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Enhanced withAuth middleware with rate limiting
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, AuthenticatedUser, ApiResponse } from './api-middleware';

export function withRateLimit(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: any[]) => Promise<NextResponse>,
  options: {
    requiredRole?: 'admin' | 'club_leader' | 'member';
    allowedRoles?: ('admin' | 'club_leader' | 'member')[];
    rateLimitKey?: string;
    customIdentifier?: (request: NextRequest, user?: AuthenticatedUser) => string;
  } = {}
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {

      const rateLimitKey = options.rateLimitKey || getEndpointKey(request.url);
      const rateLimiter = createRateLimiter(rateLimitKey);
      

      const { user, error } = await authenticateRequest(request);
      
  
      let identifier: string;
      if (options.customIdentifier) {
        identifier = options.customIdentifier(request, user || undefined);
      } else if (user) {
        identifier = user.id;
      } else {
   
        identifier = getClientIP(request);
      }
      
  
      const { allowed, resetTime, remaining } = await rateLimiter(request, identifier);
      
      if (!allowed) {
        const resetDate = new Date(resetTime || 0);
        
        return NextResponse.json({
          success: false,
          error: 'Too many requests',
          resetTime: resetDate.toISOString(),
          message: 'Rate limit exceeded. Please try again later.'
        }, { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_CONFIGS[rateLimitKey]?.maxRequests.toString() || '30',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': Math.ceil((resetTime || 0 - Date.now()) / 1000).toString()
          }
        });
      }
      

      if (!user || error) {
        return ApiResponse.unauthorized(error ?? 'Authentication required');
      }
      

      if (options?.requiredRole && user.role !== options.requiredRole && user.role !== 'admin') {
        return ApiResponse.forbidden('Insufficient permissions');
      }
      
      if (options?.allowedRoles && !options.allowedRoles.includes(user.role) && user.role !== 'admin') {
        return ApiResponse.forbidden('Insufficient permissions');
      }
      

      const response = await handler(request, user, ...args);
  
      if (response.headers) {
        response.headers.set('X-RateLimit-Limit', RATE_LIMIT_CONFIGS[rateLimitKey]?.maxRequests.toString() || '30');
        response.headers.set('X-RateLimit-Remaining', remaining?.toString() || '0');
        response.headers.set('X-RateLimit-Reset', new Date(resetTime || 0).toISOString());
      }
      
      return response;
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      return ApiResponse.error('Internal server error');
    }
  };
}

function getEndpointKey(url: string): string {
  const pathname = new URL(url).pathname;
  
  // Map endpoints to rate limit keys
  if (pathname.startsWith('/api/auth')) return '/api/auth';
  if (pathname.startsWith('/api/files')) return '/api/files';
  if (pathname.startsWith('/api/clubs')) return '/api/clubs';
  if (pathname.startsWith('/api/tasks')) return '/api/tasks';
  if (pathname.startsWith('/api/meetings')) return '/api/meetings';
  
  return 'default';
}

function getClientIP(request: NextRequest): string {

  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  

  return 'unknown-ip';
}

