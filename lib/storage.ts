import { supabase } from './supabase';

// chat-media is a private bucket (see supabase/schema.sql) — every read
// needs a short-lived signed URL scoped to a chat member.
export async function getChatMediaSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
