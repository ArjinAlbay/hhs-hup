// src/lib/supabase.ts - Supabase client instance
import { createClient } from '@/utils/supabase/server'

// Export the server client as the default supabase instance
export const supabase = createClient()

// Re-export createClient for compatibility
export { createClient }