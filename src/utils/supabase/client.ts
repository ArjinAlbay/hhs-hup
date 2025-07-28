// src/lib/supabase-client.ts - ENHANCED TOKEN MANAGEMENT
import { createBrowserClient, createServerClient } from '@supabase/ssr'

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
   
        persistSession: true,
        
     
        autoRefreshToken: true,
        
  
        detectSessionInUrl: true,
        

        flowType: 'pkce',
        
  
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        
 
        debug: false,
      },
      

      global: {
        headers: {
          'x-client-info': 'nextjs-supabase-client'
        }
      }
    }
  )
  
  
  return client
}

export function createServerClientForAPI(req: any, res: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies || {}).map(name => ({
            name,
            value: req.cookies[name]
          }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieString = [
              `${name}=${value}`,
              'Path=/',
              options?.httpOnly ? 'HttpOnly' : '',
              options?.secure ? 'Secure' : '',
              options?.sameSite ? `SameSite=${options.sameSite}` : 'SameSite=lax',
              options?.maxAge ? `Max-Age=${options.maxAge}` : ''
            ].filter(Boolean).join('; ')
            
            res.setHeader('Set-Cookie', cookieString)
          })
        },
      },
      // ✅ NEW: Enhanced auth config for API routes
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true
      }
    }
  )
}