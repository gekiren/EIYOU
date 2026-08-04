import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import LazyImage from './LazyImage.native.jsx';

const MEAL_TYPE_LABELS = {
  breakfast: '🌅 朝食',
  lunch: '☀️ 昼食',
  dinner: '🌙 夕食',
  snack: '☕ 間食',
};

const MEAL_TYPE_COLORS = {
  breakfast: '#f59e0b',
  lunch: '#3b82f6',
  dinner: '#6366f1',
  snack: '#10b981',
};

export default function MealLogList({
  mealLogs = [],
  favorites = [],
  onDeleteMeal = () => {},
  onEditMeal = () => {},
  onToggleFavorite = () => {},
  onPreviewPhoto = () => {}
}) {
  const isFav = (name) => {
    const clean = (name || '').trim().toLowerCase();
    return favorites.some(f => (f.name || '').trim().toLowerCase() === clean);
  };

  if (!Array.isArray(mealLogs) || mealLogs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>🍽️ 本日の食事記録はありません。</Text>
        <Text style={styles.emptySubText}>上の「📷 写真記録」「💬 チャット入力」「📋 MD一括」「⭐ 履歴から」ボタンから食事を追加してください。</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📝 食事ログ一覧 ({mealLogs.length}件)</Text>
      {mealLogs.map((log, idx) => {
        if (!log) return null;
        const typeLabel = MEAL_TYPE_LABELS[log.mealType] || '🍴 食事';
        const typeColor = MEAL_TYPE_COLORS[log.mealType] || '#3b82f6';
        const favorited = isFav(log.name);
        const cardKey = `meallog-${log.id || log.name || idx}-${idx}`;

        return (
          <View key={cardKey} style={styles.logCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
                <Text style={styles.typeBadgeText}>{typeLabel}</Text>
              </View>
              <Text style={styles.mealName} numberOfLines={1}>{log.name}</Text>
              <Text style={styles.caloriesText}>{log.calories || 0} kcal</Text>
            </View>

            {/* 画像プレビュー（タップして読み込む遅延ロード） */}
            {Boolean(log.photoUrl) && (
              <LazyImage
                uri={log.photoUrl}
                onPressFullPreview={onPreviewPhoto}
                placeholderText="📷 写真を表示（タップで読み込み）"
              />
            )}

            {/* PFC ＆ 塩分 ＆ 食物繊維 */}
            <View style={styles.pfcRow}>
              <Text style={styles.pfcItem}>P: <Text style={styles.pfcVal}>{log.protein || 0}g</Text></Text>
              <Text style={styles.pfcItem}>F: <Text style={styles.pfcVal}>{log.fat || 0}g</Text></Text>
              <Text style={styles.pfcItem}>C: <Text style={styles.pfcVal}>{log.carbs || 0}g</Text></Text>
              <Text style={styles.pfcItem}>塩: <Text style={styles.pfcVal}>{log.sodium || 0}g</Text></Text>
              {log.fiber !== undefined && log.fiber !== null && (
                <Text style={styles.pfcItem}>繊維: <Text style={styles.pfcVal}>{log.fiber}g</Text></Text>
              )}
            </View>

            {/* メモ */}
            {Boolean(log.memo) && (
              <Text style={styles.memoText} numberOfLines={2}>💡 {log.memo}</Text>
            )}

            {/* アクションボタン（お気に入り、編集、削除） */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, favorited && styles.favActiveBtn]}
                onPress={() => onToggleFavorite(log)}
              >
                <Text style={[styles.actionBtnText, favorited && styles.favActiveText]}>
                  {favorited ? '★ お気に入り解除' : '☆ お気に入り追加'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => onEditMeal(log)}>
                <Text style={styles.actionBtnText}>✏️ 編集</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDeleteMeal(log.id)}>
                <Text style={styles.deleteBtnText}>🗑️ 削除</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  mealName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  caloriesText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
  },
  pfcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  pfcItem: {
    fontSize: 12,
    color: '#94a3b8',
  },
  pfcVal: {
    fontWeight: '700',
    color: '#f8fafc',
  },
  memoText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 4,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  favActiveBtn: {
    backgroundColor: '#f59e0b22',
    borderColor: '#f59e0b',
  },
  favActiveText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  deleteBtn: {
    borderColor: '#ef444455',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f87171',
  },
});
