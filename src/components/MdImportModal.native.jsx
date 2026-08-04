import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput
} from 'react-native';
import { parseMealMarkdown } from '../shared_modules/md/markdownMealParser.js';

const MD_TEMPLATE = `| 日付 | 分類 | メニュー | カロリー | P | F | C | 塩分 | 食物繊維 | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-04 | 朝食 | 鮭おにぎりと味噌汁 | 420 | 18.5 | 6.0 | 72.0 | 2.1 | 3.5 | 美味しかった |
| 2026-08-04 | 昼食 | 鶏胸肉サラダボウル | 550 | 42.0 | 14.0 | 48.0 | 1.8 | 6.2 | ヘルシー |`;

export default function MdImportModal({
  visible,
  onClose,
  selectedDate,
  onBatchSave
}) {
  const [mdText, setMdText] = useState('');
  const [parsedMeals, setParsedMeals] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!visible) return null;

  const handleParse = () => {
    setErrorMsg('');
    if (!mdText.trim()) {
      setErrorMsg('Markdownテキストを入力してください。');
      return;
    }
    const results = parseMealMarkdown(mdText, selectedDate);
    if (!results || results.length === 0) {
      setErrorMsg('有効な食事データが検出できませんでした。フォーマットを確認してください。');
      return;
    }
    setParsedMeals(results);
    setSelectedIndices(results.map((_, i) => i));
  };

  const toggleSelectAll = () => {
    if (!parsedMeals) return;
    if (selectedIndices.length === parsedMeals.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(parsedMeals.map((_, i) => i));
    }
  };

  const toggleSelectIndex = (idx) => {
    if (selectedIndices.includes(idx)) {
      setSelectedIndices(selectedIndices.filter(i => i !== idx));
    } else {
      setSelectedIndices([...selectedIndices, idx]);
    }
  };

  const handleConfirmSave = () => {
    if (!parsedMeals || selectedIndices.length === 0) return;
    const selectedMeals = selectedIndices.map(i => parsedMeals[i]);
    onBatchSave(selectedMeals);
    setMdText('');
    setParsedMeals(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 MDテキスト一括取り込み</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* ガイド切り替えボタン */}
            <TouchableOpacity style={styles.guideToggleBtn} onPress={() => setShowGuide(!showGuide)}>
              <Text style={styles.guideToggleBtnText}>
                {showGuide ? '📖 ガイドを閉じる' : '💡 MD記載方法・テンプレート例'}
              </Text>
            </TouchableOpacity>

            {showGuide && (
              <View style={styles.guideCard}>
                <Text style={styles.guideTitle}>▼ 動作対応Markdownフォーマット</Text>
                <Text style={styles.guideText}>
                  1. テーブル形式 (| 分類 | メニュー | kcal | P | F | C | 塩 | 繊維 |){'\n'}
                  2. リスト形式 (- 朝食: サケ定食 (550kcal, P:28g, F:18g, C:65g))
                </Text>
                <TouchableOpacity
                  style={styles.insertTemplateBtn}
                  onPress={() => setMdText(MD_TEMPLATE)}
                >
                  <Text style={styles.insertTemplateBtnText}>📄 テンプレートを挿入する</Text>
                </TouchableOpacity>
              </View>
            )}

            {!parsedMeals ? (
              <>
                <Text style={styles.fieldLabel}>Markdownテキストをコピペしてください</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Obsidianやメモ帳からコピペ..."
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={8}
                  value={mdText}
                  onChangeText={setMdText}
                />

                {Boolean(errorMsg) && <Text style={styles.errorText}>⚠️ {errorMsg}</Text>}

                <TouchableOpacity style={styles.parseBtn} onPress={handleParse}>
                  <Text style={styles.parseBtnText}>🔍 テキストを解析してプレビュー</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* プレビューヘッダー */}
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewTitle}>
                    検知された食事項目 ({selectedIndices.length} / {parsedMeals.length}件選択中)
                  </Text>
                  <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
                    <Text style={styles.selectAllBtnText}>
                      {selectedIndices.length === parsedMeals.length ? '全解除' : '全選択'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 各解析項目のプレビューリスト */}
                {parsedMeals.map((item, idx) => {
                  const isChecked = selectedIndices.includes(idx);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.parsedCard, isChecked && styles.parsedCardChecked]}
                      onPress={() => toggleSelectIndex(idx)}
                    >
                      <View style={styles.parsedCardHeader}>
                        <Text style={styles.checkboxText}>{isChecked ? '☑️' : '⬜'}</Text>
                        <Text style={styles.parsedDate}>{item.date || selectedDate}</Text>
                        <Text style={styles.parsedType}>[{item.mealType || 'lunch'}]</Text>
                        <Text style={styles.parsedName} numberOfLines={1}>{item.name}</Text>
                      </View>
                      <Text style={styles.parsedNutrients}>
                        {item.calories} kcal | P:{item.protein}g | F:{item.fat}g | C:{item.carbs}g | 塩:{item.sodium}g | 繊維:{item.fiber || 0}g
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity style={styles.reInputBtn} onPress={() => setParsedMeals(null)}>
                    <Text style={styles.reInputBtnText}>↩️ 再入力</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmSaveBtn, selectedIndices.length === 0 && styles.disabledBtn]}
                    onPress={handleConfirmSave}
                    disabled={selectedIndices.length === 0}
                  >
                    <Text style={styles.confirmSaveBtnText}>💾 選択した項目を一括保存</Text>
                  </TouchableOpacity>
                </View>
              </>
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
    maxHeight: '90%',
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
  guideToggleBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  guideToggleBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  guideCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  guideTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  guideText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 8,
  },
  insertTemplateBtn: {
    backgroundColor: '#3b82f622',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  insertTemplateBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    minHeight: 140,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 10,
  },
  parseBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  parseBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  selectAllBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectAllBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  parsedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  parsedCardChecked: {
    borderColor: '#10b981',
    backgroundColor: '#10b98115',
  },
  parsedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  checkboxText: {
    fontSize: 14,
  },
  parsedDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  parsedType: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
  parsedName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  parsedNutrients: {
    fontSize: 11,
    color: '#cbd5e1',
    marginLeft: 22,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reInputBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  reInputBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  confirmSaveBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  confirmSaveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
