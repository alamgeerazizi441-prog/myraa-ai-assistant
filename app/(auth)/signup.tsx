import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth-context';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      setError('Sab fields bharna zaroori hai.');
      return;
    }
    if (password.length < 6) {
      setError('Password kam se kam 6 characters ka ho.');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signUp(email.trim(), password, name.trim());
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  };

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneTitle}>Account ban gaya!</Text>
        <Text style={styles.doneText}>
          Agar email confirmation on hai to apna inbox check karein, warna seedha login karein.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>Login karein</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Text style={styles.title}>Account banayein</Text>
        <TextInput style={styles.input} placeholder="Naam" placeholderTextColor="#8a8a8a" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8a8a8a"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8a8a8a"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>Pehle se account hai? Login karein</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  form: { flex: 1, padding: 24, paddingTop: 90 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 28, color: '#075E54' },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    fontSize: 16,
  },
  error: { color: '#d32f2f', marginBottom: 10 },
  button: { backgroundColor: '#128C7E', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkButton: { marginTop: 18, alignItems: 'center' },
  linkText: { color: '#128C7E', fontSize: 15, fontWeight: '600' },
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  doneTitle: { fontSize: 22, fontWeight: '800', color: '#075E54', marginBottom: 12 },
  doneText: { textAlign: 'center', color: '#555', marginBottom: 28, lineHeight: 20 },
});
