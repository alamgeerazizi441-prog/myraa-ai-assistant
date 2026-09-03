# Myraa — a free, IMO-style chat + calling app

Android app banaya gaya hai Expo (React Native) mein — text chat, groups,
voice calls, video calls, aur 24-hour stories/status ke saath. Poora stack
**bilkul free tiers** par chalta hai, koi paid API/service zaroori nahi.

## Kya-kya bana hai

- Email/password login & signup
- 1-on-1 aur group text chat, real-time
- Photo/video sharing in chat
- Voice calls aur video calls (WebRTC)
- Stories/Status — photo/video, 24 ghante ke liye
- Call history
- Profile (naam, about, avatar)

## Free tech stack

| Piece | Tool | Free tier |
|---|---|---|
| App | Expo (React Native) + expo-router | 100% free, open source |
| Backend/DB/Auth | [Supabase](https://supabase.com) | Free project: 500MB DB, 1GB storage, 2GB bandwidth/month |
| Realtime chat | Supabase Realtime (Postgres change feed + Broadcast) | Included in free tier |
| Voice/video calls | WebRTC (`react-native-webrtc`) | Peer-to-peer, no server cost |
| STUN/TURN (call relay) | Google public STUN + [Open Relay Project](https://www.metered.ca/tools/openrelay/) public TURN | Free, no signup |
| Android build | [EAS Build](https://expo.dev/eas) free tier | Free builds/month, no credit card |

## 1. Supabase project set up karein (5 min, free)

1. [supabase.com](https://supabase.com) par free account banayein, **New Project** banayein.
2. Project ke andar **SQL Editor** kholein, aur `supabase/schema.sql` file ka poora content paste karke **Run** karein. Ye sab tables, RLS policies, realtime aur storage buckets bana dega.
3. **Settings → API** mein jaake apna **Project URL** aur **anon public key** copy karein.
4. Repo root mein `.env.example` ko `.env` mein copy karein aur values daalein:

   ```
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
   ```

5. **Authentication → Providers** mein Email provider already on hota hai. Agar aap chahte hain users signup ke baad turant login kar sakein bina email confirm kiye, to **Authentication → Settings** mein "Confirm email" ko off kar dein (testing ke liye).

## 2. App install & run karein

```bash
npm install
```

`react-native-webrtc` ek native module hai, isliye **Expo Go** app mein nahi
chalega — aapko ek custom "dev client" chahiye. Do free options hain:

### Option A — EAS free cloud build (Android Studio ki zaroorat nahi)

```bash
npm install -g eas-cli
eas login          # free Expo account
eas build --profile development --platform android
```

Build khatam hone par ek APK link milega — usse apne Android phone par
install karein, phir:

```bash
npx expo start --dev-client
```

Phone par khula hua dev client app QR scan karke connect ho jayega.

### Option B — Local build (agar Android Studio installed hai)

```bash
npx expo run:android
```

## 3. Final installable APK banayein (free)

Jab app ready ho jaye, ek shareable APK banane ke liye:

```bash
eas build --profile preview --platform android
```

Ye ek direct-download APK link dega — koi Play Store zaroori nahi, bilkul
free distribution.

## Architecture notes

- **Chat**: messages Postgres table mein store hoti hain, Supabase Realtime
  se instantly sab members ke devices par push hoti hain (`lib/webrtc.ts`
  nahi, `app/chat/[id].tsx` dekhein).
- **Calls**: signaling (offer/answer/ICE) Supabase Realtime **Broadcast**
  channels se hoti hai (`call:<callId>`) — koi alag signaling server nahi
  chahiye. Actual audio/video peer-to-peer WebRTC se jaata hai, free STUN +
  free TURN relay ke through jab direct connection na bane. Dekhein
  `lib/webrtc.ts`.
- **Stories**: Supabase Storage ke free bucket mein upload hoti hain,
  `expires_at` (24h) ke baad list se automatically filter ho jaati hain.

## Free-tier limitations (aage badhane ke liye)

- Calls abhi **1-to-1** hain. Group calls ke liye har participant ke beech
  ek mesh of peer connections banana padega (same signaling pattern reuse
  ho sakta hai).
- Open Relay Project ka TURN demo server hai — halka traffic ke liye theek
  hai. Zyada users ke liye apna free-tier TURN lagayein (Metered.ca free
  50GB/month, ya khud ka coturn ek free-tier VM par).
- Push notifications (jab app band ho) abhi wire nahi hain — `expo-notifications`
  already installed hai, Supabase Edge Function se trigger kiya ja sakta hai (free tier).
- Supabase free tier projects 1 week inactivity ke baad pause ho sakte hain
  — bas dashboard se ek click mein resume ho jaate hain.
