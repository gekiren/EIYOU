import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { sanitizeNumberInput } from '../utils/inputSanitizer';

const PRESET_MULTIPLIERS = [0.5, 0.7, 1.0, 1.2, 1.5, 2.0];

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default function EditMealLogModal({
  visible,
  onClose,
  editMealName,
  setEditMealName,
  editMealType,
  setEditMealType,
  editCalories,
  setEditCalories,
  editProtein,
  setEditProtein,
  editFat,
  setEditFat,
  editCarbs,
  setEditCarbs,
  editSodium,
  setEditSodium,
  editFiber,
  setEditFiber,
  editMemo,
  setEditMemo,
  editBaseNutrition,   // 元の栄養素値（倍率計算の基準）
  onSaveEdit
}) {
  const [multiplier, setMultiplier] = useState(1.0);
  const [isCustom, setIsCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  // モーダルが開くたびに倍率をリセット
  useEffect(() => {
    if (visible) {
      setMultiplier(1.0);
      setIsCustom(false);
      setCustomText('');
    }
  }, [visible]);

  // 倍率変更時に表示値を更新
  const applyMultiplier = useCallback((m) => {
    if (!editBaseNutrition) return;
    setEditCalories(String(round2(editBaseNutrition.calories * m)));
    setEditProtein(String(round2(editBaseNutrition.protein * m)));
    setEditFat(String(round2(editBaseNutrition.fat * m)));
    setEditCarbs(String(round2(editBaseNutrition.carbs * m)));
    setEditSodium(String(round2(editBaseNutrition.sodium * m)));
    setEditFiber(String(round2(editBaseNutrition.fiber * m)));
  }, [editBaseNutrition, setEditCalories, setEditProtein, setEditFat, setEditCarbs, setEditSodium, setEditFiber]);

  const handlePresetPress = (m) => {
    setMultiplier(m);
    setIsCustom(false);
    setCustomText('');
    applyMultiplier(m);
  };

  const handleCustomChange = (t) => {
    setCustomText(t);
    const parsed = parseFloat(t);
    if (!isNaN(parsed) && parsed > 0) {
      const m = Math.round(parsed * 100) / 100;
      setMultiplier(m);
      applyMultiplier(m);
    }
  };

  const handleSave = () => {
    const vals = {
      calories: Number(editCalories) || 0,
      protein:  Number(editProtein)  || 0,
      fat:      Number(editFat)      || 0,
      carbs:    Number(editCarbs)    || 0,
      sodium:   Number(editSodium)   || 0,
      fiber:    Number(editFiber)    || 0,
    };
    onSaveEdit(vals);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* ヘッダー */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ 食事ログの編集</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {/* 食事区分 */}
            <Text style={styles.fieldLabel}>食事区分</Text>
            <View style={styles.mealTypeRow}>
              {[
                { key: 'breakfast', label: '🌅 朝食' },
                { key: 'lunch',     label: '☀️ 昼食' },
                { key: 'dinner',    label: '🌙 夕食' },
                { key: 'snack',     label: '☕ 間食' }
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.typeBtn, editMealType === type.key && styles.activeTypeBtn]}
                  onPress={() => setEditMealType(type.key)}
                >
                  <Text style={[styles.typeBtnText, editMealType === type.key && styles.activeTypeBtnText]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 食事・料理名 */}
            <Text style={styles.fieldLabel}>食事・料理名</Text>
            <TextInput
              style={styles.textInput}
              value={editMealName}
              onChangeText={setEditMealName}
            />

            {/* ────── 食べた倍率調整 ────── */}
            <View style={styles.portionCard}>
              <Text style={styles.portionTitle}>🍽️ 食べた量の倍率調整（{multiplier}倍）</Text>
              <View style={styles.presetRow}>
                {PRESET_MULTIPLIERS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.presetBtn,
                      !isCustom && multiplier === m && styles.activePresetBtn
                    ]}
                    onPress={() => handlePresetPress(m)}
                  >
                    <Text style={[
                      styles.presetBtnText,
                      !isCustom && multiplier === m && styles.activePresetBtnText
                    ]}>
                      {m}倍
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.presetBtn, isCustom && styles.activeCustomPresetBtn]}
                  onPress={() => {
                    setIsCustom(true);
                    setCustomText(String(multiplier));
                  }}
                >
                  <Text style={[styles.presetBtnText, isCustom && styles.activeCustomPresetBtnText]}>
                    ✏️
                  </Text>
                </TouchableOpacity>
              </View>
              {isCustom && (
                <View style={styles.customRow}>
                  <Text style={styles.customLabel}>カスタム倍率:</Text>
                  <TextInput
                    style={styles.customInput}
                    keyboardType="decimal-pad"
                    placeholder="例: 0.8"
                    placeholderTextColor="#64748b"
                    value={customText}
                    onChangeText={handleCustomChange}
                    autoFocus
                  />
                  <Text style={styles.customUnit}>倍</Text>
                </View>
              )}
            </View>

            {/* 栄養成分グリッド */}
            <View style={styles.inputGrid}>
              <View style={styles.inputCell}>
                <Text style={styles.fieldLabel}>カロリー (kcal)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editCalories}
                  onChangeText={(t) => setEditCalories(sanitizeNumberInput(t))}
                />
              </View>

              <View style={styles.inputCell}>
                <Text style={styles.fieldLabel}>タンパク質 (g)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editProtein}
                  onChangeText={(t) => setEditProtein(sanitizeNumberInput(t))}
                />
              </View>

              <View style={styles.inputCell}>
                <Text style={styles.fieldLabel}>脂質 (g)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editFat}
                  onChangeText={(t) => setEditFat(sanitizeNumberInput(t))}
                />
              </View>

              <View style={styles.inputCell}>
                <Text style={styles.fieldLabel}>炭水化物 (g)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editCarbs}
                  onChangeText={(t) => setEditCarbs(sanitizeNumberInput(t))}
                />
              </View>

              <View style={styles.inputCell}>
                <Text style={styles.fieldLabel}>塩分 (g)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editSodium}
                  onChangeText={(t) => setEditSodium(sanitizeNumberInput(t))}
                />
              </View>

              <View style={styles.inputCell}>
                <Text style={styles.fieldLabel}>食物繊維 (g)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editFiber}
                  onChangeText={(t) => setEditFiber(sanitizeNumberInput(t))}
                />
              </View>
            </View>

            {/* メモ */}
            <Text style={styles.fieldLabel}>メモ / 備考</Text>
            <TextInput
              style={styles.textInput}
              placeholder="メモを入力..."
              placeholderTextColor="#64748b"
              value={editMemo}
              onChangeText={setEditMemo}
            />

            {/* 保存ボタン */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>💾 変更を保存する</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    marginTop: 8,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
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
  textInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  inputCell: {
    width: '48%',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── 倍率カード ──
  portionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  portionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
  },
  activePresetBtn: {
    backgroundColor: '#f59e0b22',
    borderColor: '#f59e0b',
  },
  presetBtnText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activePresetBtnText: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  activeCustomPresetBtn: {
    backgroundColor: '#8b5cf622',
    borderColor: '#8b5cf6',
  },
  activeCustomPresetBtnText: {
    color: '#8b5cf6',
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  customLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  customInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  customUnit: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
