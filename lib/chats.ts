import { supabase } from './supabase';

export async function findOrCreateDirectChat(selfId: string, otherId: string): Promise<string> {
  const { data: mine } = await supabase
    .from('chat_members')
    .select('chat_id, chats!inner(id, is_group)')
    .eq('user_id', selfId)
    .eq('chats.is_group', false);

  for (const row of mine ?? []) {
    const { data: members } = await supabase.from('chat_members').select('user_id').eq('chat_id', row.chat_id);
    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.includes(otherId) && ids.length === 2) {
      return row.chat_id;
    }
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .insert({ is_group: false, created_by: selfId })
    .select('id')
    .single();
  if (error || !chat) throw error;

  await supabase.from('chat_members').insert([
    { chat_id: chat.id, user_id: selfId, role: 'owner' },
    { chat_id: chat.id, user_id: otherId, role: 'member' },
  ]);

  return chat.id;
}
