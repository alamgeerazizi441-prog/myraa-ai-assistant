export type Profile = {
  id: string;
  phone: string | null;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  about: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
};

export type Chat = {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string;
};

export type ChatMember = {
  chat_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | 'audio' | 'file' | null;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  expires_at: string;
};

export type Call = {
  id: string;
  chat_id: string;
  caller_id: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined';
  started_at: string;
  ended_at: string | null;
};

// Shape of messages broadcast over the `call:<call_id>` Supabase Realtime
// channel while a call is being set up / torn down (WebRTC signaling).
export type CallSignal =
  | { type: 'offer'; from: string; sdp: string }
  | { type: 'answer'; from: string; sdp: string }
  | { type: 'ice-candidate'; from: string; candidate: unknown }
  | { type: 'hangup'; from: string }
  | { type: 'decline'; from: string };
