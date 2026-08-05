import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { triggerSuccess } from '../utils/hapticsService';

export default function QuickFavoritesBar({ favorites = [], onSelectFavorite }) {
  if (!Array.isArray(favorites) || favorites.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>⭐ お気に入りを登録すると、ここから1タップで記録できます</Text>
      </View>
    );
  }

  const handlePress = (item) => {
    triggerSuccess();
    if (onSelectFavorite) {
      onSelectFavorite(item);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>⭐ クイックお気に入り記録</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {favorites.map((item, index) => {
          const name = typeof item === 'string' ? item : item.name;
          const cal = typeof item === 'object' && item.calories ? `${item.calories}kcal` : '';

          return (
            <TouchableOpacity
              key={index}
              style={styles.chip}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipName} numberOfLines={1}>
                {name}
              </Text>
              {cal ? <Text style={styles.chipCal}>{cal}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 8,
  },
  emptyContainer: {
    marginVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    backgroundColor: '#3b82f61a',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  chipCal: {
    fontSize: 11,
    color: '#93c5fd',
    fontWeight: 'bold',
  },
});
