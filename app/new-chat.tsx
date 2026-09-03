import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { findOrCreateDirectChat } from '../lib/chats';
import { Avatar } from '../components/Avatar';
import type { Profile } from '../lib/types';

export default function NewChatScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Profile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const q = supabase.from('profiles').select('*').neq('id', session?.user.id ?? '').order('display_name');
      const term = query.trim();
      const { data } = term ? await q.or(`display_name.ilike.%${term}%,phone.ilike.%${term}%`) : await q.limit(50);
      setPeople((data as Profile[]) ?? []);
    };
    load();
  }, [query, session]);

  const openChatWith = async (other: Profile) => {
    if (!session) return;
    setBusyId(other.id);
    try {
      const chatId = await findOrCreateDirectChat(session.user.id, other.id);
      router.replace({ pathname: '/chat/[id]', params: { id: chatId, title: other.display_name } });
    } catch (err) {
      console.warn('[open chat]', err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput style={styles.searchInput} placeholder="Search by name or phone number" value={query} onChangeText={setQuery} />
      </View>

      <Pressable style={styles.groupRow} onPress={() => router.replace('/new-group')}>
        <View style={styles.groupIcon}>
          <Ionicons name="people" size={22} color="#fff" />
        </View>
        <Text style={styles.groupText}>New Group</Text>
      </Pressable>

      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Koi user nahi mila.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openChatWith(item)} disabled={busyId === item.id}>
            <Avatar uri={item.avatar_url} name={item.display_name} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.about} numberOfLines={1}>
                {item.about}
              </Text>
            </View>
            {busyId === item.id ? <ActivityIndicator /> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 15 },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  groupIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center' },
  groupText: { marginLeft: 14, fontSize: 16, fontWeight: '700', color: '#111' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  rowText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  about: { fontSize: 13, color: '#888', marginTop: 2 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
