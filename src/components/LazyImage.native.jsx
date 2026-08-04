import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';

export default function LazyImage({
  uri,
  style,
  onPressFullPreview,
  placeholderText = '📷 タップして写真を表示'
}) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!uri) return null;

  const handleLoad = () => {
    setLoading(true);
    setError(false);
    setLoaded(true);
  };

  return (
    <View style={styles.container}>
      {!loaded ? (
        <TouchableOpacity style={styles.placeholderBtn} onPress={handleLoad} activeOpacity={0.7}>
          <Text style={styles.placeholderText}>{placeholderText}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.imageWrapper}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#38bdf8" />
            </View>
          )}
          {error ? (
            <TouchableOpacity style={styles.errorBox} onPress={handleLoad}>
              <Text style={styles.errorText}>⚠️ 画像の読み込みに失敗しました（タップで再試行）</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={onPressFullPreview ? 0.8 : 1}
              onPress={() => onPressFullPreview && onPressFullPreview(uri)}
            >
              <Image
                source={{ uri }}
                style={[styles.image, style]}
                resizeMode="cover"
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
              {onPressFullPreview && (
                <Text style={styles.photoHint}>🔍 タップで拡大</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.hideBtn} onPress={() => setLoaded(false)}>
            <Text style={styles.hideBtnText}>🙈 隠す</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  placeholderBtn: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderColor: '#991b1b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 11,
  },
  photoHint: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#ffffff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hideBtn: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 5,
  },
  hideBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
});
