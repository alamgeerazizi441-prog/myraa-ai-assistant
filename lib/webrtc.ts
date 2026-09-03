import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { CallSignal } from './types';

// Free STUN (Google, public) + free TURN (Open Relay Project, public demo
// credentials - no signup required: https://www.metered.ca/tools/openrelay/).
// For heavier production traffic, swap these for your own free-tier TURN
// (e.g. Metered.ca free tier gives 50GB/month) via env vars below.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export type CallRole = 'caller' | 'callee';
export type CallKind = 'audio' | 'video';
export type CallPhase = 'connecting' | 'ringing' | 'connected' | 'ended';

export function useWebRTCCall(callId: string, role: CallRole, kind: CallKind, selfId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<CallPhase>('connecting');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const remoteDescSet = useRef(false);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setPhase('ended');
  }, [localStream]);

  const send = useCallback((signal: CallSignal) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: signal });
  }, []);

  const hangup = useCallback(() => {
    send({ type: 'hangup', from: selfId });
    supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId)
      .then(() => {});
    cleanup();
  }, [callId, cleanup, selfId, send]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  }, [localStream, muted]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff((c) => !c);
  }, [localStream, cameraOff]);

  useEffect(() => {
    endedRef.current = false;
    let mounted = true;

    const setup = async () => {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { facingMode: 'user' } : false,
      });
      if (!mounted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event: any) => {
        setRemoteStream(event.streams[0]);
        setPhase('connected');
        supabase.from('calls').update({ status: 'ongoing' }).eq('id', callId).then(() => {});
      };
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          send({ type: 'ice-candidate', from: selfId, candidate: event.candidate.toJSON() });
        }
      };

      const channel = supabase.channel(`call:${callId}`, {
        config: { presence: { key: selfId }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      const applyRemoteCandidates = async () => {
        remoteDescSet.current = true;
        for (const c of pendingCandidates.current) {
          await pc.addIceCandidate(c);
        }
        pendingCandidates.current = [];
      };

      channel.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: CallSignal }) => {
        if (payload.from === selfId) return;
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
          await applyRemoteCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'answer', from: selfId, sdp: answer.sdp! });
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
          await applyRemoteCandidates();
        } else if (payload.type === 'ice-candidate') {
          const candidate = new RTCIceCandidate(payload.candidate as any);
          if (remoteDescSet.current) {
            await pc.addIceCandidate(candidate);
          } else {
            pendingCandidates.current.push(candidate);
          }
        } else if (payload.type === 'hangup' || payload.type === 'decline') {
          cleanup();
        }
      });

      channel.on('presence', { event: 'sync' }, () => {
        if (role !== 'caller') return;
        const state = channel.presenceState();
        const others = Object.keys(state).filter((k) => k !== selfId);
        if (others.length > 0 && pc.signalingState === 'stable' && !pc.localDescription) {
          setPhase('ringing');
          pc.createOffer()
            .then(async (offer) => {
              await pc.setLocalDescription(offer);
              send({ type: 'offer', from: selfId, sdp: offer.sdp! });
            })
            .catch(() => {});
        }
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joined_at: Date.now() });
        }
      });
    };

    setup().catch((err) => {
      console.warn('[call] setup failed', err);
      cleanup();
    });

    return () => {
      mounted = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  return { localStream, remoteStream, phase, muted, cameraOff, hangup, toggleMute, toggleCamera };
}

type RTCIceServer = { urls: string; username?: string; credential?: string };
