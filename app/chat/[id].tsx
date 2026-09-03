import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { SecureChatImage } from '../../components/SecureChatImage';
import type { Message } from '../../lib/types';

export default function ChatScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', id)
      .eq('deleted', false)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data as Message[]) ?? []);
  }, [id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (!session) return;
    supabase.from('chat_members').update({ last_read_at: new Date().toISOString() }).eq('chat_id', id).eq('user_id', session.user.id).then(() => {});
  }, [id, session]);

  const send = async () => {
    if (!text.trim() || !session || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    const { error } = await supabase.from('messages').insert({ chat_id: id, sender_id: session.user.id, content: body });
    if (error) console.warn('[send message]', error);
    setSending(false);
  };

  const sendMedia = async () => {
    if (!session) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    if (result.canceled) return;

    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const path = `${id}/${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
    const response = await fetch(asset.uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(path, arrayBuffer, { contentType: isVideo ? 'video/mp4' : 'image/jpeg' });
    if (uploadError) {
      console.warn('[media upload]', uploadError);
      return;
    }
    // chat-media is a private bucket — store the object path, not a public
    // URL; readers resolve it to a short-lived signed URL (see SecureChatImage).
    await supabase.from('messages').insert({
      chat_id: id,
      sender_id: session.user.id,
      media_url: path,
      media_type: isVideo ? 'video' : 'image',
    });
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!session) return;
    const { data, error } = await supabase
      .from('calls')
      .insert({ chat_id: id, caller_id: session.user.id, type, status: 'ringing' })
      .select('id')
      .single();
    if (error || !data) {
      console.warn('[start call]', error);
      return;
    }
    router.push({ pathname: '/call/[id]', params: { id: data.id, type, role: 'caller', chatId: id } });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: title ?? 'Chat',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => startCall('audio')} style={styles.headerBtn}>
                <Ionicons name="call" size={22} color="#fff" />
              </Pressable>
              <Pressable onPress={() => startCall('video')} style={styles.headerBtn}>
                <Ionicons name="videocam" size={24} color="#fff" />
              </Pressable>
            </View>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === session?.user.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {item.media_url && item.media_type === 'image' ? (
                <SecureChatImage path={item.media_url} style={styles.mediaImage} />
              ) : null}
              {item.content ? <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.content}</Text> : null}
              <Text style={styles.bubbleTime}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <Pressable onPress={sendMedia} style={styles.attachBtn}>
          <Ionicons name="add-circle" size={28} color="#128C7E" />
        </Pressable>
        <TextInput style={styles.input} placeholder="Message" value={text} onChangeText={setText} multiline />
        <Pressable onPress={send} style={styles.sendBtn} disabled={!text.trim()}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  headerButtons: { flexDirection: 'row', gap: 18, marginRight: 4 },
  headerBtn: { padding: 4 },
  bubble: { maxWidth: '78%', borderRadius: 14, padding: 10, marginBottom: 8 },
  bubbleMine: { backgroundColor: '#DCF8C6', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  bubbleTheirs: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  bubbleTextMine: { color: '#111', fontSize: 15 },
  bubbleTextTheirs: { color: '#111', fontSize: 15 },
  bubbleTime: { fontSize: 10, color: '#888', alignSelf: 'flex-end', marginTop: 4 },
  mediaImage: { width: 220, height: 220, borderRadius: 10, marginBottom: 6 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: '#f7f7f7', gap: 8 },
  attachBtn: { paddingBottom: 6 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120, fontSize: 15 },
  sendBtn: { backgroundColor: '#128C7E', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
