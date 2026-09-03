import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { Avatar } from '../../components/Avatar';
import { formatTimeShort } from '../../lib/format';

type CallRow = {
  id: string;
  chat_id: string;
  type: 'audio' | 'video';
  status: string;
  started_at: string;
  outgoing: boolean;
  otherName: string;
  otherAvatar: string | null;
};

export default function CallsScreen() {
  const { session } = useAuth();
  const [calls, setCalls] = useState<CallRow[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: memberships } = await supabase.from('chat_members').select('chat_id').eq('user_id', session.user.id);
    const chatIds = (memberships ?? []).map((m) => m.chat_id);
    if (chatIds.length === 0) {
      setCalls([]);
      return;
    }

    const { data } = await supabase
      .from('calls')
      .select('id, chat_id, caller_id, type, status, started_at')
      .in('chat_id', chatIds)
      .order('started_at', { ascending: false })
      .limit(50);

    const enriched = await Promise.all(
      (data ?? []).map(async (call) => {
        const { data: other } = await supabase
          .from('chat_members')
          .select('profiles(display_name, avatar_url)')
          .eq('chat_id', call.chat_id)
          .neq('user_id', session.user.id)
          .limit(1)
          .maybeSingle();
        return {
          id: call.id,
          chat_id: call.chat_id,
          type: call.type,
          status: call.status,
          started_at: call.started_at,
          outgoing: call.caller_id === session.user.id,
          otherName: (other?.profiles as any)?.display_name ?? 'Unknown',
          otherAvatar: (other?.profiles as any)?.avatar_url ?? null,
        } as CallRow;
      })
    );
    setCalls(enriched);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Koi call history nahi hai.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.chat_id}`)}>
            <Avatar uri={item.otherAvatar} name={item.otherName} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.otherName}</Text>
              <View style={styles.metaRow}>
                <Ionicons
                  name={item.outgoing ? 'arrow-up-outline' : 'arrow-down-outline'}
                  size={14}
                  color={item.status === 'missed' || item.status === 'declined' ? '#d32f2f' : '#4caf50'}
                />
                <Text style={styles.meta}>
                  {' '}
                  {item.status === 'missed' ? 'Missed' : item.status === 'declined' ? 'Declined' : item.outgoing ? 'Outgoing' : 'Incoming'}
                </Text>
              </View>
            </View>
            <View style={styles.right}>
              <Text style={styles.time}>{formatTimeShort(item.started_at)}</Text>
              <Ionicons name={item.type === 'video' ? 'videocam' : 'call'} size={20} color="#128C7E" style={{ marginTop: 6 }} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  meta: { fontSize: 13, color: '#777' },
  right: { alignItems: 'flex-end' },
  time: { fontSize: 12, color: '#999' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
