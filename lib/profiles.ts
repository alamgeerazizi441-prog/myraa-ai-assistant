import { supabase } from './supabase';
import type { Profile } from './types';

// `phone` is deliberately excluded here — it's not readable via a plain
// select (see supabase/schema.sql). Use findProfileByPhone() for lookups.
export const PUBLIC_PROFILE_COLUMNS = 'id, username, display_name, avatar_url, about, is_online, last_seen, created_at';

export async function findProfileByPhone(phone: string): Promise<Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'about'> | null> {
  const { data, error } = await supabase.rpc('find_profile_by_phone', { lookup_phone: phone.trim() });
  if (error || !data || data.length === 0) return null;
  return data[0];
}
