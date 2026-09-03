import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export function IncomingCallListener() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    const selfId = session.user.id;

    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: 'status=eq.ringing' },
        async ({ new: call }: any) => {
          if (call.caller_id === selfId) return;
          const { data: membership } = await supabase
            .from('chat_members')
            .select('chat_id')
            .eq('chat_id', call.chat_id)
            .eq('user_id', selfId)
            .maybeSingle();
          if (!membership) return;
          router.push({
            pathname: '/call/[id]',
            params: { id: call.id, type: call.type, role: 'callee', chatId: call.chat_id },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  return null;
}
