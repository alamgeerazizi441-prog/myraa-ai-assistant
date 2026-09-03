import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/Avatar';

export default function ProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [about, setAbout] = useState(profile?.about ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    if (!session) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: name.trim(), about: about.trim() }).eq('id', session.user.id);
    await refreshProfile();
    setSaving(false);
  };

  const changeAvatar = async () => {
    if (!session) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const path = `${session.user.id}/avatar-${Date.now()}.jpg`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', session.user.id);
      await refreshProfile();
    } catch (err) {
      console.warn('[avatar upload]', err);
    } finally {
      setUploading(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Log out', 'Kya aap sach mein log out karna chahte hain?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <View style={styles.avatarWrap}>
        <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? 'Me'} size={100} />
        <Pressable style={styles.avatarEdit} onPress={changeAvatar} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={18} color="#fff" />}
        </Pressable>
      </View>

      <Text style={styles.label}>Naam</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Aapka naam" />

      <Text style={styles.label}>About</Text>
      <TextInput style={styles.input} value={about} onChangeText={setAbout} placeholder="Kuch likhein apne baare mein" />

      <Text style={styles.emailLabel}>{session?.user.email}</Text>

      <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={confirmSignOut}>
        <Ionicons name="log-out-outline" size={18} color="#d32f2f" />
        <Text style={styles.signOutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  avatarWrap: { alignSelf: 'center', marginBottom: 32 },
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#128C7E',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  label: { fontSize: 13, color: '#128C7E', fontWeight: '700', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  emailLabel: { marginTop: 16, color: '#999', fontSize: 13 },
  saveButton: { backgroundColor: '#128C7E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingVertical: 12 },
  signOutText: { color: '#d32f2f', fontWeight: '700', fontSize: 15 },
});
