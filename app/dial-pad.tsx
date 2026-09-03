import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { findOrCreateDirectChat } from '../lib/chats';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export default function DialPadScreen() {
  const { session } = useAuth();
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const press = (key: string) => setNumber((n) => n + key);
  const backspace = () => setNumber((n) => n.slice(0, -1));

  const findUser = async () => {
    const term = number.trim();
    if (!term || !session) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', term)
      .neq('id', session.user.id)
      .maybeSingle();
    if (!data) {
      Alert.alert('Nahi mila', 'Ye number Myraa par register nahi hai. Sirf app par register users ko call/message kiya ja sakta hai (free).');
      return null;
    }
    return data;
  };

  const onCall = async () => {
    setBusy(true);
    try {
      const other = await findUser();
      if (!other || !session) return;
      const chatId = await findOrCreateDirectChat(session.user.id, other.id);
      const { data: call, error } = await supabase
        .from('calls')
        .insert({ chat_id: chatId, caller_id: session.user.id, type: 'audio', status: 'ringing' })
        .select('id')
        .single();
      if (error || !call) throw error;
      router.replace({ pathname: '/call/[id]', params: { id: call.id, type: 'audio', role: 'caller', chatId } });
    } catch (err) {
      console.warn('[dial call]', err);
    } finally {
      setBusy(false);
    }
  };

  const onMessage = async () => {
    setBusy(true);
    try {
      const other = await findUser();
      if (!other || !session) return;
      const chatId = await findOrCreateDirectChat(session.user.id, other.id);
      router.replace({ pathname: '/chat/[id]', params: { id: chatId, title: other.display_name } });
    } catch (err) {
      console.warn('[dial message]', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.display}>
        <Text style={styles.displayText}>{number || 'Number likhein'}</Text>
        {number.length > 0 ? (
          <Pressable onPress={backspace} hitSlop={12}>
            <Ionicons name="backspace-outline" size={24} color="#555" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pad}>
        {KEYS.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((key) => (
              <Pressable key={key} style={styles.key} onPress={() => press(key)}>
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.messageBtn]} onPress={onMessage} disabled={busy || !number}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="chatbubble" size={24} color="#fff" />}
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.callBtn]} onPress={onCall} disabled={busy || !number}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="call" size={26} color="#fff" />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 16 },
  display: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
  displayText: { fontSize: 28, fontWeight: '600', color: '#111' },
  pad: { alignItems: 'center', gap: 18 },
  row: { flexDirection: 'row', gap: 28 },
  key: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 26, fontWeight: '600', color: '#111' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 32 },
  actionBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  messageBtn: { backgroundColor: '#128C7E' },
  callBtn: { backgroundColor: '#25D366' },
});
