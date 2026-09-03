-- Myraa database schema for Supabase (Postgres)
-- Run this once in your Supabase project's SQL editor (free tier is enough).
-- Docs: https://supabase.com/docs/guides/database/overview

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  username text unique,
  display_name text not null default 'New User',
  avatar_url text,
  about text default 'Available',
  is_online boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'New User'), new.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CHATS (1-1 and groups)
-- ============================================================
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  avatar_url text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;

drop policy if exists "Members can view their chats" on public.chats;
create policy "Members can view their chats"
  on public.chats for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = chats.id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can create chats" on public.chats;
create policy "Authenticated users can create chats"
  on public.chats for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Owners/admins can update chat" on public.chats;
create policy "Owners/admins can update chat"
  on public.chats for update
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = chats.id and cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Members can view membership rows of their chats" on public.chat_members;
create policy "Members can view membership rows of their chats"
  on public.chat_members for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members me
      where me.chat_id = chat_members.chat_id and me.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can add members to chats they created or admin" on public.chat_members;
create policy "Authenticated users can add members to chats they created or admin"
  on public.chat_members for insert
  to authenticated
  with check (true);

drop policy if exists "Members can leave a chat" on public.chat_members;
create policy "Members can leave a chat"
  on public.chat_members for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'audio', 'file')),
  reply_to uuid references public.messages (id),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted boolean not null default false
);

create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "Members can view messages in their chats" on public.messages;
create policy "Members can view messages in their chats"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can send messages in their chats" on public.messages;
create policy "Members can send messages in their chats"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Senders can edit/delete their own messages" on public.messages;
create policy "Senders can edit/delete their own messages"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid());

-- Bump chats.last_message_at whenever a new message arrives (drives chat list ordering)
create or replace function public.touch_chat_last_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.touch_chat_last_message();

-- ============================================================
-- STORIES (24h ephemeral posts, like IMO/WhatsApp status)
-- ============================================================
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists "Non-expired stories are viewable by authenticated users" on public.stories;
create policy "Non-expired stories are viewable by authenticated users"
  on public.stories for select
  to authenticated
  using (expires_at > now());

drop policy if exists "Users can post their own stories" on public.stories;
create policy "Users can post their own stories"
  on public.stories for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories"
  on public.stories for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Story views are readable by authenticated users" on public.story_views;
create policy "Story views are readable by authenticated users"
  on public.story_views for select
  to authenticated
  using (true);

drop policy if exists "Users can record their own story views" on public.story_views;
create policy "Users can record their own story views"
  on public.story_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- ============================================================
-- CALLS (voice/video call history; live signaling happens over
-- Supabase Realtime Broadcast on channel `call:<call_id>`, not the DB)
-- ============================================================
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  caller_id uuid not null references public.profiles (id),
  type text not null check (type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'ongoing', 'ended', 'missed', 'declined')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.call_participants (
  call_id uuid not null references public.calls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

drop policy if exists "Chat members can view calls" on public.calls;
create policy "Chat members can view calls"
  on public.calls for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = calls.chat_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Chat members can start calls" on public.calls;
create policy "Chat members can start calls"
  on public.calls for insert
  to authenticated
  with check (
    caller_id = auth.uid()
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = calls.chat_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Participants can update call status" on public.calls;
create policy "Participants can update call status"
  on public.calls for update
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
      where cm.chat_id = calls.chat_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Call participants are viewable by chat members" on public.call_participants;
create policy "Call participants are viewable by chat members"
  on public.call_participants for select
  to authenticated
  using (true);

drop policy if exists "Users manage their own call participation" on public.call_participants;
create policy "Users manage their own call participation"
  on public.call_participants for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own call participation" on public.call_participants;
create policy "Users can update their own call participation"
  on public.call_participants for update
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- REALTIME: enable logical replication for the tables the app subscribes to
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'chats', 'chat_members', 'calls', 'stories']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- STORAGE BUCKETS (create in Supabase Studio > Storage, or via SQL below)
-- avatars/stories stay public (broadcast-style, like a profile photo or a
-- WhatsApp status). chat-media is PRIVATE: only members of the chat it
-- belongs to may read it, via short-lived signed URLs the app requests.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('stories', 'stories', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read for app media buckets" on storage.objects;
drop policy if exists "Public read for public media buckets" on storage.objects;
create policy "Public read for public media buckets"
  on storage.objects for select
  to public
  using (bucket_id in ('avatars', 'stories'));

drop policy if exists "Chat members can read their chat media" on storage.objects;
create policy "Chat members can read their chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (storage.foldername(name))[1]::uuid
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can upload media" on storage.objects;
drop policy if exists "Authenticated users can upload to public buckets" on storage.objects;
create policy "Authenticated users can upload to public buckets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('avatars', 'stories'));

drop policy if exists "Chat members can upload chat media" on storage.objects;
create policy "Chat members can upload chat media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = (storage.foldername(name))[1]::uuid
        and cm.user_id = auth.uid()
    )
  );

-- ============================================================
-- PHONE NUMBER PRIVACY: the `phone` column must not be bulk-readable by
-- any authenticated client (that would let anyone dump every user's
-- number). Revoke direct column access and expose it only through two
-- narrow, purpose-built functions: read your own phone, or check whether
-- one exact number belongs to a registered account.
-- ============================================================
revoke select on public.profiles from authenticated;
grant select (id, username, display_name, avatar_url, about, is_online, last_seen, created_at)
  on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_profile() to authenticated;

create or replace function public.find_profile_by_phone(lookup_phone text)
returns table (id uuid, display_name text, avatar_url text, about text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.display_name, p.avatar_url, p.about
  from public.profiles p
  where p.phone = lookup_phone and p.id <> auth.uid()
  limit 1;
$$;

grant execute on function public.find_profile_by_phone(text) to authenticated;
