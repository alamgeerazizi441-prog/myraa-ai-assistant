import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { Avatar } from '../../components/Avatar';

type StoryGroup = {
  userId: string;
  name: string;
  avatar: string | null;
  thumb: string;
  count: number;
  isMine: boolean;
};

export default function StoriesScreen() {
  const { session, profile } = useAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('stories')
      .select('id, user_id, media_url, created_at, profiles(display_name, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const byUser = new Map<string, StoryGroup>();
    (data ?? []).forEach((s: any) => {
      if (!byUser.has(s.user_id)) {
        byUser.set(s.user_id, {
          userId: s.user_id,
          name: s.profiles?.display_name ?? 'Unknown',
          avatar: s.profiles?.avatar_url ?? null,
          thumb: s.media_url,
          count: 1,
          isMine: s.user_id === session.user.id,
        });
      } else {
        byUser.get(s.user_id)!.count += 1;
      }
    });
    setGroups(Array.from(byUser.values()));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addStory = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
    });
    if (result.canceled || !session) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      const ext = isVideo ? 'mp4' : 'jpg';
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(path, arrayBuffer, { contentType: isVideo ? 'video/mp4' : 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);
      await supabase.from('stories').insert({
        user_id: session.user.id,
        media_url: pub.publicUrl,
        media_type: isVideo ? 'video' : 'image',
      });
      await load();
    } catch (err) {
      console.warn('[story upload]', err);
    } finally {
      setUploading(false);
    }
  };

  const myGroup = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);

  return (
    <View style={styles.container}>
      <Pressable style={styles.myRow} onPress={myGroup ? () => router.push(`/story/${session!.user.id}`) : addStory} disabled={uploading}>
        <View>
          <Avatar uri={profile?.avatar_url ?? myGroup?.thumb} name={profile?.display_name ?? 'Me'} size={56} />
          <View style={styles.addBadge}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={16} color="#fff" />}
          </View>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>My Status</Text>
          <Text style={styles.sub}>{myGroup ? `${myGroup.count} update(s) · tap to view` : 'Tap to add a status update'}</Text>
        </View>
        {myGroup ? (
          <Pressable onPress={addStory} hitSlop={12}>
            <Ionicons name="camera" size={22} color="#128C7E" />
          </Pressable>
        ) : null}
      </Pressable>

      <Text style={styles.sectionTitle}>Recent updates</Text>
      <FlatList
        data={others}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={<Text style={styles.empty}>Abhi koi status update nahi hai.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.myRow} onPress={() => router.push(`/story/${item.userId}`)}>
            <View style={styles.ring}>
              <Avatar uri={item.avatar} name={item.name} size={52} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{item.count} update(s)</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 8 },
  myRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  ring: { borderWidth: 2, borderColor: '#25D366', borderRadius: 30, padding: 2 },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#128C7E',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  rowText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, color: '#128C7E', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
