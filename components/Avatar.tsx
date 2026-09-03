import { Image, StyleSheet, Text, View } from 'react-native';
import { initials } from '../lib/format';

export function Avatar({ uri, name, size = 52 }: { uri?: string | null; name: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name || '?')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: '#e0e0e0' },
  fallback: { backgroundColor: '#128C7E', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
