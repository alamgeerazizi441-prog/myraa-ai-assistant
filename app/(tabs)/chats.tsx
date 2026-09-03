import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { Avatar } from '../../components/Avatar';
import { formatTimeShort } from '../../lib/format';

type ChatRow = {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string;
  lastMessagePreview: string;
  otherName: string;
  otherAvatar: string | null;
};

export default function ChatsScreen() {
  const { session, profile } = useAuth();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: memberships } = await supabase
      .from('chat_members')
      .select('chat_id, chats(id, is_group, name, avatar_url, last_message_at)')
      .eq('user_id', session.user.id);

    const rows = (memberships ?? [])
      .map((m: any) => m.chats)
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    const enriched = await Promise.all(
      rows.map(async (chat: any) => {
        let otherName = chat.name ?? 'Group';
        let otherAvatar = chat.avatar_url;

        if (!chat.is_group) {
          const { data: other } = await supabase
            .from('chat_members')
            .select('profiles(display_name, avatar_url)')
            .eq('chat_id', chat.id)
            .neq('user_id', session.user.id)
            .limit(1)
            .maybeSingle();
          otherName = (other?.profiles as any)?.display_name ?? 'Unknown';
          otherAvatar = (other?.profiles as any)?.avatar_url ?? null;
        }

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, media_type, created_at')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const preview = lastMsg
          ? lastMsg.content ?? (lastMsg.media_type ? `📎 ${lastMsg.media_type}` : '')
          : 'Say hi 👋';

        return {
          id: chat.id,
          is_group: chat.is_group,
          name: chat.name,
          avatar_url: chat.avatar_url,
          last_message_at: chat.last_message_at,
          lastMessagePreview: preview,
          otherName,
          otherAvatar,
        } as ChatRow;
      })
    );

    setChats(enriched);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('chats-list-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_members', filter: `user_id=eq.${session.user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Koi chat nahi hai abhi. Naya chat shuru karein!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, title: item.is_group ? item.name ?? 'Group' : item.otherName } })}
          >
            <Avatar uri={item.is_group ? item.avatar_url : item.otherAvatar} name={item.is_group ? item.name ?? 'Group' : item.otherName} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.is_group ? item.name ?? 'Group' : item.otherName}
              </Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessagePreview}
              </Text>
            </View>
            <Text style={styles.time}>{formatTimeShort(item.last_message_at)}</Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/new-chat')}>
        <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  preview: { fontSize: 14, color: '#777', marginTop: 2 },
  time: { fontSize: 12, color: '#999' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyText: { color: '#888', textAlign: 'center', fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#128C7E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
