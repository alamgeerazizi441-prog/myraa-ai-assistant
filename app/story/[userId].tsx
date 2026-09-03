import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import type { Story } from '../../lib/types';
import { Avatar } from '../../components/Avatar';

const STORY_DURATION_MS = 5000;

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: storyData }, { data: authorData }] = await Promise.all([
        supabase
          .from('stories')
          .select('*')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true }),
        supabase.from('profiles').select('display_name').eq('id', userId).single(),
      ]);
      setStories((storyData as Story[]) ?? []);
      setAuthorName(authorData?.display_name ?? '');
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (stories.length === 0) return;
    const current = stories[index];
    if (session && current) {
      supabase.from('story_views').upsert({ story_id: current.id, viewer_id: session.user.id }).then(() => {});
    }

    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: STORY_DURATION_MS, useNativeDriver: false }).start();
    timerRef.current = setTimeout(next, STORY_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stories]);

  const next = () => {
    setIndex((i) => {
      if (i + 1 < stories.length) return i + 1;
      router.back();
      return i;
    });
  };

  const prev = () => setIndex((i) => Math.max(0, i - 1));

  if (stories.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading...</Text>
      </View>
    );
  }

  const current = stories[index];

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {stories.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <Avatar name={authorName} size={36} />
        <Text style={styles.authorName}>{authorName}</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>

      {current.media_type === 'video' ? (
        <Video source={{ uri: current.media_url }} style={styles.media} resizeMode={ResizeMode.CONTAIN} shouldPlay useNativeControls={false} />
      ) : (
        <Image source={{ uri: current.media_url }} style={styles.media} resizeMode="contain" />
      )}

      {current.caption ? (
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      ) : null}

      <View style={styles.tapZones}>
        <Pressable style={styles.tapZone} onPress={prev} />
        <Pressable style={styles.tapZone} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 54, zIndex: 2 },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, gap: 10, zIndex: 2 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },
  closeBtn: { padding: 6 },
  media: { flex: 1, width: '100%' },
  captionWrap: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  caption: { color: '#fff', fontSize: 15, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 8 },
  tapZones: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' },
  tapZone: { flex: 1 },
});
