import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { getChatMediaSignedUrl } from '../lib/storage';

export function SecureChatImage({ path, style }: { path: string; style: StyleProp<ImageStyle> }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getChatMediaSignedUrl(path).then((signedUrl) => {
      if (mounted) setUrl(signedUrl);
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  if (!url) {
    return (
      <View style={[style, styles.placeholder]}>
        <ActivityIndicator color="#999" />
      </View>
    );
  }

  return <Image source={{ uri: url }} style={style} />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
});
