import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';

export default function ChatRecordModal({
  visible,
  onClose,
  chatInput,
  setChatInput,
  chatAnalyzing,
  chatAnalyzedData,
  chatMealType,
  setChatMealType,
  aiThinkingMode = 'quick',
  onToggleThinkingMode,
  onAnalyzeChat,
  onSaveChatMeal
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>💬 AIチャット食事入力</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.guideText}>
              食べたメニューを自然な文章で入力してください。AIが料理構成・栄養成分を自動計算します。
            </Text>
            <Text style={styles.exampleText}>
              例: 「朝食に鮭おにぎり2個と豆腐の味噌汁を食べた」「昼に特製ハンバーグ定食（ご飯大盛り）」
            </Text>

            {/* AI解析モード切替 */}
            <Text style={styles.fieldLabel}>AI解析モード</Text>
            <View style={styles.thinkingTabRow}>
              <TouchableOpacity
                style={[styles.thinkingTab, aiThinkingMode === 'quick' && styles.activeThinkingTabQuick]}
                onPress={() => onToggleThinkingMode && onToggleThinkingMode('quick')}
              >
                <Text style={[styles.thinkingTabText, aiThinkingMode === 'quick' && styles.activeThinkingTabText]}>
                  ⚡ クイック (思考なし)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.thinkingTab, aiThinkingMode === 'thinking' && styles.activeThinkingTabThinking]}
                onPress={() => onToggleThinkingMode && onToggleThinkingMode('thinking')}
              >
                <Text style={[styles.thinkingTabText, aiThinkingMode === 'thinking' && styles.activeThinkingTabText]}>
                  🧠 シンキング (思考あり)
                </Text>
              </TouchableOpacity>
            </View>

            {/* 食事区分 */}
            <Text style={styles.fieldLabel}>食事区分</Text>
            <View style={styles.mealTypeRow}>
              {[
                { key: 'breakfast', label: '🌅 朝食' },
                { key: 'lunch', label: '☀️ 昼食' },
                { key: 'dinner', label: '🌙 夕食' },
                { key: 'snack', label: '☕ 間食' }
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.typeBtn, chatMealType === type.key && styles.activeTypeBtn]}
                  onPress={() => setChatMealType(type.key)}
                >
                  <Text style={[styles.typeBtnText, chatMealType === type.key && styles.activeTypeBtnText]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 入力テキストエリア */}
            <TextInput
              style={styles.chatTextArea}
              placeholder="食べたものをここに入力..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              value={chatInput}
              onChangeText={setChatInput}
            />

            {/* 解析実行ボタン */}
            <TouchableOpacity style={styles.analyzeBtn} onPress={onAnalyzeChat} disabled={chatAnalyzing}>
              {chatAnalyzing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.analyzeBtnText}>✨ AIで栄養分析・計算する</Text>
              )}
            </TouchableOpacity>

            {/* 解析結果表示カード */}
            {chatAnalyzedData && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>🎯 AI推定栄養データ</Text>

                <View style={styles.resultMainRow}>
                  <Text style={styles.mealNameText}>{chatAnalyzedData.mealName || '解析料理'}</Text>
                  <Text style={styles.calText}>{chatAnalyzedData.calories || 0} kcal</Text>
                </View>

                <View style={styles.pfcGrid}>
                  <Text style={styles.pfcTag}>P: {chatAnalyzedData.protein || 0}g</Text>
                  <Text style={styles.pfcTag}>F: {chatAnalyzedData.fat || 0}g</Text>
                  <Text style={styles.pfcTag}>C: {chatAnalyzedData.carbs || 0}g</Text>
                  <Text style={styles.pfcTag}>塩分: {chatAnalyzedData.sodium || 0}g</Text>
                  {chatAnalyzedData.fiber !== undefined && (
                    <Text style={styles.pfcTag}>繊維: {chatAnalyzedData.fiber || 0}g</Text>
                  )}
                </View>

                {Boolean(chatAnalyzedData.advice) && (
                  <Text style={styles.adviceText}>💡 {chatAnalyzedData.advice}</Text>
                )}

                <TouchableOpacity style={styles.saveChatBtn} onPress={onSaveChatMeal}>
                  <Text style={styles.saveChatBtnText}>💾 この内容で記録を保存</Text>
                </TouchableOpacity>
              </View>
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
    maxHeight: '85%',
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
  scrollBody: {
    paddingBottom: 24,
  },
  guideText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
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
  chatTextArea: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  analyzeBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  analyzeBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#10b98155',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  resultMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  calText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  pfcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  pfcTag: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  adviceText: {
    fontSize: 12,
    color: '#94a3b8',
    marginVertical: 6,
  },
  saveChatBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveChatBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  thinkingTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  thinkingTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeThinkingTabQuick: {
    backgroundColor: '#0284c722',
    borderColor: '#0284c7',
  },
  activeThinkingTabThinking: {
    backgroundColor: '#8b5cf622',
    borderColor: '#8b5cf6',
  },
  thinkingTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeThinkingTabText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
});
