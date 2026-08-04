import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput
} from 'react-native';
import LazyImage from './LazyImage.native.jsx';

export default function HistorySelectModal({
  visible,
  onClose,
  allHistoryLogs = [],
  favorites = [],
  historyTargetMealType,
  setHistoryTargetMealType,
  onAddFromHistory,
  onPreviewPhoto
}) {
  const [activeTab, setActiveTab] = useState('favorites'); // 'favorites' | 'recent' | 'frequent'
  const [searchQuery, setSearchQuery] = useState('');
  const [multiplier, setMultiplier] = useState(1.0); // 0.5x, 1.0x, 1.5x, 2.0x などの倍数選択

  if (!visible) return null;

  // タブ・検索フィルタリング（堅牢化 ＆ メモリ保護）
  const displayItems = useMemo(() => {
    try {
      let items = [];

      if (activeTab === 'favorites') {
        items = Array.isArray(favorites) ? favorites : [];
      } else if (activeTab === 'recent') {
        items = Array.isArray(allHistoryLogs) ? allHistoryLogs : [];
      } else if (activeTab === 'frequent') {
        // 頻出順集計
        const map = new Map();
        const logs = Array.isArray(allHistoryLogs) ? allHistoryLogs : [];
        
        logs.forEach(item => {
          if (!item) return;
          const key = (item.name || '').trim();
          if (!key) return;
          if (!map.has(key)) {
            // 軽量な基本データのみ参照コピー
            map.set(key, {
              id: item.id,
              name: item.name,
              calories: item.calories,
              protein: item.protein,
              fat: item.fat,
              carbs: item.carbs,
              sodium: item.sodium,
              fiber: item.fiber,
              photoUrl: item.photoUrl,
              memo: item.memo,
              count: 0
            });
          }
          map.get(key).count += 1;
        });

        items = Array.from(map.values()).sort((a, b) => b.count - a.count);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        items = items.filter(i => i && (i.name || '').toLowerCase().includes(q));
      }

      // レンダリング負荷対策：表示件数を上位80件に安全スライス
      return items.slice(0, 80);
    } catch (e) {
      console.warn('[HistorySelectModal] displayItems computation error:', e);
      return [];
    }
  }, [activeTab, favorites, allHistoryLogs, searchQuery]);

  const calcVal = (val, mult) => (Math.round((Number(val) || 0) * mult * 10) / 10);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⭐ 履歴・お気に入りから追加</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 食事区分の選択 */}
          <Text style={styles.sectionLabel}>追加先区分</Text>
          <View style={styles.mealTypeRow}>
            {[
              { key: 'breakfast', label: '朝食' },
              { key: 'lunch', label: '昼食' },
              { key: 'dinner', label: '夕食' },
              { key: 'snack', label: '間食' }
            ].map(type => (
              <TouchableOpacity
                key={type.key}
                style={[styles.typeBtn, historyTargetMealType === type.key && styles.activeTypeBtn]}
                onPress={() => setHistoryTargetMealType(type.key)}
              >
                <Text style={[styles.typeBtnText, historyTargetMealType === type.key && styles.activeTypeBtnText]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* クイック倍数選択UI */}
          <Text style={styles.sectionLabel}>量の倍数設定 ({multiplier}倍)</Text>
          <View style={styles.multiplierRow}>
            {[0.5, 0.7, 1.0, 1.2, 1.5, 2.0].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.multBtn, multiplier === m && styles.activeMultBtn]}
                onPress={() => setMultiplier(m)}
              >
                <Text style={[styles.multBtnText, multiplier === m && styles.activeMultBtnText]}>
                  {m}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* カテゴリタブ */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
              onPress={() => setActiveTab('favorites')}
            >
              <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>⭐ お気に入り</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'recent' && styles.activeTab]}
              onPress={() => setActiveTab('recent')}
            >
              <Text style={[styles.tabText, activeTab === 'recent' && styles.activeTabText]}>🕒 直近の履歴</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'frequent' && styles.activeTab]}
              onPress={() => setActiveTab('frequent')}
            >
              <Text style={[styles.tabText, activeTab === 'frequent' && styles.activeTabText]}>🔥 よく食べる</Text>
            </TouchableOpacity>
          </View>

          {/* 検索入力 */}
          <TextInput
            style={styles.searchInput}
            placeholder="メニュー名で検索..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* リスト表示 */}
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {displayItems.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>該当する登録メニューがありません。</Text>
              </View>
            ) : (
              displayItems.map((item, idx) => {
                if (!item) return null;
                const scaledCal = Math.round((Number(item.calories) || 0) * multiplier);
                const scaledP = calcVal(item.protein, multiplier);
                const scaledF = calcVal(item.fat, multiplier);
                const scaledC = calcVal(item.carbs, multiplier);
                const scaledSodium = calcVal(item.sodium, multiplier);
                const scaledFiber = calcVal(item.fiber, multiplier);

                const itemKey = `hist-${activeTab}-${item.id || item.name || idx}-${idx}`;

                return (
                  <View key={itemKey} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                        {item.count ? <Text style={styles.countBadge}> ({item.count}回)</Text> : ''}
                      </Text>
                      <Text style={styles.itemCal}>{scaledCal} kcal</Text>
                    </View>

                    {/* 遅延ロード写真表示（写真がある場合） */}
                    {Boolean(item.photoUrl) && (
                      <LazyImage
                        uri={item.photoUrl}
                        onPressFullPreview={onPreviewPhoto}
                        placeholderText="📷 写真を表示（タップで読み込み）"
                      />
                    )}

                    <Text style={styles.itemNutrients}>
                      P:{scaledP}g | F:{scaledF}g | C:{scaledC}g | 塩:{scaledSodium}g
                      {scaledFiber > 0 ? ` | 繊維:${scaledFiber}g` : ''}
                    </Text>

                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => {
                        onAddFromHistory({
                          ...item,
                          calories: scaledCal,
                          protein: scaledP,
                          fat: scaledF,
                          carbs: scaledC,
                          sodium: scaledSodium,
                          fiber: scaledFiber,
                          mealType: historyTargetMealType
                        });
                      }}
                    >
                      <Text style={styles.addBtnText}>➕ 今日の記録に追加 ({multiplier}x)</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTypeBtn: {
    backgroundColor: '#3b82f622',
    borderColor: '#3b82f6',
  },
  typeBtnText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  activeTypeBtnText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  multiplierRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  multBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeMultBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  multBtnText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeMultBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  scrollBody: {
    paddingBottom: 24,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  itemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  countBadge: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '400',
  },
  itemCal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  itemNutrients: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 12,
  },
});
