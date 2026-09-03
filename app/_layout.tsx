import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import { IncomingCallListener } from '../components/IncomingCallListener';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <IncomingCallListener />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" options={{ headerShown: true, headerStyle: { backgroundColor: '#128C7E' }, headerTintColor: '#fff' }} />
          <Stack.Screen name="call/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="story/[userId]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="new-chat" options={{ headerShown: true, title: 'New Chat', presentation: 'modal' }} />
          <Stack.Screen name="new-group" options={{ headerShown: true, title: 'New Group', presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit Profile', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
