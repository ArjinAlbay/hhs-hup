// src/lib/auth.ts
import { createClient } from '@/utils/supabase/server'
import { createClient as createBrowserClient } from '@/utils/supabase/client'

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'club_leader' | 'member';
  clubId?: string;
  isActive: boolean;
}

export class AuthService {
  static async getCurrentUser(): Promise<AuthUser | null> {
    const supabase = await createClient()
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }

    // Get user details from custom users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, updated_at')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (userError || !userData) {
      return null
    }

    // For club leaders, fetch their club information
    let clubId: string | undefined = undefined;
    
    if (userData.role === 'club_leader') {
      // Club leaders should have a club where they are the leader
      const { data: leaderClub } = await supabase
        .from('clubs')
        .select('id')
        .eq('leader_id', user.id)
        .single()
      
      clubId = leaderClub?.id;
    } else if (userData.role === 'member') {
      // Members get their club from club_members table
      const { data: memberShip } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .single()
      
      clubId = memberShip?.club_id;
    }

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      clubId: clubId,
      isActive: userData.is_active,
    }
  }

  static async signInWithPassword(email: string, password: string) {
    const supabase = createBrowserClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      throw new Error(error?.message || 'Giriş başarısız')
    }

    return data
  }

  static async signUp(email: string, password: string, name: string) {
    const supabase = createBrowserClient()
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        }
      }
    })

    if (error) {
      throw new Error(error.message)
    }

    return data
  }

  static async signOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
  }
}