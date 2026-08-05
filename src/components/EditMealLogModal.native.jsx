import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput
} from 'react-native';
import { sanitizeNumberInput } from '../utils/inputSanitizer';

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
  onSaveEdit
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✏️ 食事ログの編集</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity style={styles.saveBtn} onPress={onSaveEdit}>
              <Text style={styles.saveBtnText}>💾 変更を保存する</Text>
            </TouchableOpacity>
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
});
