import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { Avatar } from '../components/Avatar';
import type { Profile } from '../lib/types';

export default function NewGroupScreen() {
  const { session } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .neq('id', session?.user.id ?? '')
      .order('display_name')
      .then(({ data }) => setPeople((data as Profile[]) ?? []));
  }, [session]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async () => {
    if (!session || selected.size === 0 || !name.trim()) return;
    setCreating(true);
    try {
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({ is_group: true, name: name.trim(), created_by: session.user.id })
        .select('id')
        .single();
      if (error || !chat) throw error;

      const members = [
        { chat_id: chat.id, user_id: session.user.id, role: 'owner' as const },
        ...Array.from(selected).map((id) => ({ chat_id: chat.id, user_id: id, role: 'member' as const })),
      ];
      await supabase.from('chat_members').insert(members);
      router.replace({ pathname: '/chat/[id]', params: { id: chat.id, title: name.trim() } });
    } catch (err) {
      console.warn('[create group]', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.nameInput} placeholder="Group name" value={name} onChangeText={setName} />
      <Text style={styles.sectionTitle}>{selected.size} member(s) selected</Text>

      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable style={styles.row} onPress={() => toggle(item.id)}>
              <Avatar uri={item.avatar_url} name={item.display_name} />
              <Text style={styles.name}>{item.display_name}</Text>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={isSelected ? '#128C7E' : '#ccc'}
              />
            </Pressable>
          );
        }}
      />

      <Pressable style={[styles.createBtn, (!name.trim() || selected.size === 0) && styles.createBtnDisabled]} onPress={create} disabled={creating || !name.trim() || selected.size === 0}>
        {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>Create Group</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  nameInput: { margin: 16, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  sectionTitle: { paddingHorizontal: 16, color: '#888', marginBottom: 6, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  name: { flex: 1, fontSize: 16, color: '#111' },
  createBtn: { backgroundColor: '#128C7E', margin: 16, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.5 },
  createText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
