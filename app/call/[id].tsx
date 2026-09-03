import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useWebRTCCall, type CallKind, type CallRole } from '../../lib/webrtc';
import { Avatar } from '../../components/Avatar';

export default function CallScreen() {
  const params = useLocalSearchParams<{ id: string; type: CallKind; role: CallRole; chatId: string }>();
  const { session, profile } = useAuth();
  const [accepted, setAccepted] = useState(params.role === 'caller');

  const decline = async () => {
    await supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', params.id);
    const channel = supabase.channel(`call:${params.id}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'decline', from: session?.user.id } });
        setTimeout(() => supabase.removeChannel(channel), 300);
      }
    });
    router.back();
  };

  if (!accepted) {
    return (
      <View style={styles.ringing}>
        <Avatar name={profile?.display_name ?? 'Call'} size={110} />
        <Text style={styles.ringingTitle}>Incoming {params.type === 'video' ? 'video' : 'voice'} call</Text>
        <View style={styles.ringingActions}>
          <Pressable style={[styles.roundBtn, styles.declineBtn]} onPress={decline}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
          <Pressable style={[styles.roundBtn, styles.acceptBtn]} onPress={() => setAccepted(true)}>
            <Ionicons name="call" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  return <ActiveCall callId={params.id} role={params.role} kind={params.type} selfId={session!.user.id} name={profile?.display_name ?? 'Me'} />;
}

function ActiveCall({ callId, role, kind, selfId, name }: { callId: string; role: CallRole; kind: CallKind; selfId: string; name: string }) {
  const { localStream, remoteStream, phase, muted, cameraOff, hangup, toggleMute, toggleCamera } = useWebRTCCall(callId, role, kind, selfId);

  const onHangup = () => {
    hangup();
    router.back();
  };

  if (phase === 'ended') {
    router.back();
    return null;
  }

  const isVideo = kind === 'video';

  return (
    <View style={styles.container}>
      {isVideo && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.audioBackdrop}>
          <Avatar name={name} size={120} />
        </View>
      )}

      <Text style={styles.statusText}>{phase === 'connected' ? 'Connected' : phase === 'ringing' ? 'Ringing…' : 'Connecting…'}</Text>

      {isVideo && localStream ? (
        <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} mirror />
      ) : null}

      <View style={styles.controls}>
        <Pressable style={[styles.roundBtn, styles.controlBtn, muted && styles.controlBtnActive]} onPress={toggleMute}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
        </Pressable>
        {isVideo ? (
          <Pressable style={[styles.roundBtn, styles.controlBtn, cameraOff && styles.controlBtnActive]} onPress={toggleCamera}>
            <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable style={[styles.roundBtn, styles.declineBtn]} onPress={onHangup}>
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  remoteVideo: { flex: 1 },
  audioBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#075E54' },
  statusText: { position: 'absolute', top: 60, alignSelf: 'center', color: '#fff', fontSize: 15, fontWeight: '600' },
  localVideo: { position: 'absolute', top: 60, right: 16, width: 110, height: 150, borderRadius: 12, backgroundColor: '#333' },
  controls: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 24 },
  roundBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  controlBtn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  controlBtnActive: { backgroundColor: 'rgba(255,255,255,0.5)' },
  declineBtn: { backgroundColor: '#e53935' },
  acceptBtn: { backgroundColor: '#25D366' },
  ringing: { flex: 1, backgroundColor: '#075E54', alignItems: 'center', justifyContent: 'center', gap: 20 },
  ringingTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  ringingActions: { flexDirection: 'row', gap: 60, marginTop: 40 },
});
