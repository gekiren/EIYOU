import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator
} from 'react-native';
import { sanitizeNumberInput } from '../utils/inputSanitizer';
import { triggerImpact } from '../utils/hapticsService';

export default function PhotoRecordModal({
  visible,
  onClose,
  analyzing,
  progressMsg,
  recordMode,
  setRecordMode,
  selectedImageUri,
  aiAnalysisResult,
  mealNameInput,
  setMealNameInput,
  caloriesInput,
  setCaloriesInput,
  proteinInput,
  setProteinInput,
  fatInput,
  setFatInput,
  carbsInput,
  setCarbsInput,
  sodiumInput,
  setSodiumInput,
  fiberInput,
  setFiberInput,
  mealType,
  setMealType,
  portionMultiplier,
  setPortionMultiplier,
  portionPercentage,
  setPortionPercentage,
  aiThinkingMode = 'quick',
  onToggleThinkingMode,
  onTakePhoto,
  onSelectImage,
  onSaveMeal
}) {
  const [portionMode, setPortionMode] = useState('percent'); // 'percent' | 'gram' | 'piece'
  const [baseGram, setBaseGram] = useState(100);
  const [eatenGram, setEatenGram] = useState(100);
  const [basePiece, setBasePiece] = useState(1);
  const [eatenPiece, setEatenPiece] = useState(1);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📷 写真から栄養分析・記録</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* モード選択タブ (OCR成分表示 vs 料理写真) */}
            <View style={styles.modeTabRow}>
              <TouchableOpacity
                style={[styles.modeTab, recordMode === 'ocr' && styles.activeModeTab]}
                onPress={() => setRecordMode('ocr')}
              >
                <Text style={[styles.modeTabText, recordMode === 'ocr' && styles.activeModeTabText]}>
                  📋 栄養成分表示ラベル
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, recordMode === 'dish' && styles.activeModeTab]}
                onPress={() => setRecordMode('dish')}
              >
                <Text style={[styles.modeTabText, recordMode === 'dish' && styles.activeModeTabText]}>
                  🍱 料理・食事写真
                </Text>
              </TouchableOpacity>
            </View>

            {/* AI解析思考モード切り替え */}
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

            {/* 写真選択・撮影ボタン & プレビュー */}
            <View style={styles.photoPickerBox}>
              {selectedImageUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="contain" />
                  <View style={styles.rePickActionRow}>
                    <TouchableOpacity style={[styles.rePickBtn, { backgroundColor: '#0284c7' }]} onPress={onTakePhoto}>
                      <Text style={styles.rePickBtnText}>📸 撮影し直す</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rePickBtn} onPress={onSelectImage}>
                      <Text style={styles.rePickBtnText}>🖼️ 別の画像を選ぶ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.pickActionRow}>
                  <TouchableOpacity style={[styles.pickBtn, { backgroundColor: '#0284c7', marginBottom: 8 }]} onPress={onTakePhoto}>
                    <Text style={styles.pickBtnText}>📸 アプリ内で撮影</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pickBtn, { backgroundColor: '#334155' }]} onPress={onSelectImage}>
                    <Text style={styles.pickBtnText}>🖼️ ギャラリーから選択</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 解析中表示 */}
            {analyzing && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>{progressMsg || 'AIが栄養成分を解析中...'}</Text>
              </View>
            )}

            {/* AIアドバイス表示 */}
            {aiAnalysisResult && Boolean(aiAnalysisResult.advice) && (
              <View style={styles.adviceBox}>
                <Text style={styles.adviceTitle}>💡 AIワンポイントアドバイス</Text>
                <Text style={styles.adviceText}>{aiAnalysisResult.advice}</Text>
              </View>
            )}

            {/* 量の調整インターフェース (OCRモード) */}
            {recordMode === 'ocr' && (
              <View style={styles.portionCard}>
                <Text style={styles.portionTitle}>⚖️ 食べた量の割合・単位調整</Text>

                {/* 単位切り替え */}
                <View style={styles.portionTabContainer}>
                  <TouchableOpacity
                    style={[styles.portionTab, portionMode === 'percent' && styles.activePortionTab]}
                    onPress={() => setPortionMode('percent')}
                  >
                    <Text style={[styles.portionTabText, portionMode === 'percent' && styles.activePortionTabText]}>割合 (%)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.portionTab, portionMode === 'gram' && styles.activePortionTab]}
                    onPress={() => setPortionMode('gram')}
                  >
                    <Text style={[styles.portionTabText, portionMode === 'gram' && styles.activePortionTabText]}>グラム (g)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.portionTab, portionMode === 'piece' && styles.activePortionTab]}
                    onPress={() => setPortionMode('piece')}
                  >
                    <Text style={[styles.portionTabText, portionMode === 'piece' && styles.activePortionTabText]}>個数・袋</Text>
                  </TouchableOpacity>
                </View>

                {portionMode === 'percent' && (
                  <View style={styles.presetRow}>
                    {[25, 50, 75, 100, 150, 200].map((pct) => (
                      <TouchableOpacity
                        key={pct}
                        style={[styles.presetBtn, portionPercentage === pct && styles.activePresetBtn]}
                        onPress={() => setPortionPercentage(pct)}
                      >
                        <Text style={[styles.presetBtnText, portionPercentage === pct && styles.activePresetBtnText]}>
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {portionMode === 'gram' && (
                  <View style={styles.calcInputRow}>
                    <Text style={styles.calcLabel}>ラベル表示基準:</Text>
                    <TextInput
                      style={styles.calcInput}
                      keyboardType="numeric"
                      value={String(baseGram)}
                      onChangeText={(t) => {
                        const bg = parseFloat(t) || 1;
                        setBaseGram(bg);
                        setPortionPercentage(Math.round((eatenGram / bg) * 100));
                      }}
                    />
                    <Text style={styles.calcUnit}>g 中、食べた量:</Text>
                    <TextInput
                      style={styles.calcInput}
                      keyboardType="numeric"
                      value={String(eatenGram)}
                      onChangeText={(t) => {
                        const eg = parseFloat(t) || 0;
                        setEatenGram(eg);
                        setPortionPercentage(Math.round((eg / baseGram) * 100));
                      }}
                    />
                    <Text style={styles.calcUnit}>g ({portionPercentage}%)</Text>
                  </View>
                )}

                {portionMode === 'piece' && (
                  <View style={styles.calcInputRow}>
                    <Text style={styles.calcLabel}>1包装:</Text>
                    <TextInput
                      style={styles.calcInput}
                      keyboardType="numeric"
                      value={String(basePiece)}
                      onChangeText={(t) => {
                        const bp = parseFloat(t) || 1;
                        setBasePiece(bp);
                        setPortionPercentage(Math.round((eatenPiece / bp) * 100));
                      }}
                    />
                    <Text style={styles.calcUnit}>個/個数中:</Text>
                    <TextInput
                      style={styles.calcInput}
                      keyboardType="numeric"
                      value={String(eatenPiece)}
                      onChangeText={(t) => {
                        const ep = parseFloat(t) || 0;
                        setEatenPiece(ep);
                        setPortionPercentage(Math.round((ep / basePiece) * 100));
                      }}
                    />
                    <Text style={styles.calcUnit}>個 ({portionPercentage}%)</Text>
                  </View>
                )}
              </View>
            )}

            {/* 料理写真モードの倍率調整 */}
            {recordMode === 'dish' && (
              <View style={styles.portionCard}>
                <Text style={styles.portionTitle}>🍽️ 食べた量の倍率調整 ({portionMultiplier}倍)</Text>
                <View style={styles.presetRow}>
                  {[0.5, 0.7, 1.0, 1.2, 1.5, 2.0].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.presetBtn, portionMultiplier === m && styles.activePresetBtn]}
                      onPress={() => setPortionMultiplier(m)}
                    >
                      <Text style={[styles.presetBtnText, portionMultiplier === m && styles.activePresetBtnText]}>
                        {m}倍
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 入力フォーム */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>📝 登録数値の調整・確認</Text>

              {/* 食事区分 */}
              <Text style={styles.fieldLabel}>食事の区分</Text>
              <View style={styles.mealTypeRow}>
                {[
                  { key: 'breakfast', label: '🌅 朝食' },
                  { key: 'lunch', label: '☀️ 昼食' },
                  { key: 'dinner', label: '🌙 夕食' },
                  { key: 'snack', label: '☕ 間食' }
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[styles.typeBtn, mealType === type.key && styles.activeTypeBtn]}
                    onPress={() => setMealType(type.key)}
                  >
                    <Text style={[styles.typeBtnText, mealType === type.key && styles.activeTypeBtnText]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* メニュー名 */}
              <Text style={styles.fieldLabel}>食事・食品名</Text>
              <TextInput
                style={styles.textInput}
                placeholder="例: サケ弁当"
                placeholderTextColor="#64748b"
                value={mealNameInput}
                onChangeText={setMealNameInput}
              />

              {/* 栄養素グリッド */}
              <View style={styles.inputGrid}>
                <View style={styles.inputCell}>
                  <Text style={styles.fieldLabel}>カロリー (kcal)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={caloriesInput}
                    onChangeText={(t) => setCaloriesInput(sanitizeNumberInput(t))}
                  />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.fieldLabel}>タンパク質 (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={proteinInput}
                    onChangeText={(t) => setProteinInput(sanitizeNumberInput(t))}
                  />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.fieldLabel}>脂質 (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={fatInput}
                    onChangeText={(t) => setFatInput(sanitizeNumberInput(t))}
                  />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.fieldLabel}>炭水化物 (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={carbsInput}
                    onChangeText={(t) => setCarbsInput(sanitizeNumberInput(t))}
                  />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.fieldLabel}>塩分相当量 (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={sodiumInput}
                    onChangeText={(t) => setSodiumInput(sanitizeNumberInput(t))}
                  />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.fieldLabel}>食物繊維 (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={fiberInput}
                    onChangeText={(t) => setFiberInput(sanitizeNumberInput(t))}
                  />
                </View>
              </View>

              {/* 保存ボタン */}
              <TouchableOpacity style={styles.saveSubmitBtn} onPress={onSaveMeal}>
                <Text style={styles.saveSubmitBtnText}>💾 この食事ログを保存する</Text>
              </TouchableOpacity>
            </View>
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
  modeTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeModeTab: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeModeTabText: {
    color: '#10b981',
    fontWeight: '700',
  },
  photoPickerBox: {
    marginVertical: 8,
  },
  pickActionRow: {
    alignItems: 'center',
  },
  pickBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  pickBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  rePickActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  rePickBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  rePickBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  loadingBox: {
    marginVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  loadingText: {
    color: '#10b981',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  adviceBox: {
    backgroundColor: '#10b98115',
    borderWidth: 1,
    borderColor: '#10b98144',
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },
  adviceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 4,
  },
  adviceText: {
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  portionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  portionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  portionTabContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  portionTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  activePortionTab: {
    backgroundColor: '#3b82f6',
  },
  portionTabText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  activePortionTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activePresetBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  presetBtnText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activePresetBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  calcInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  calcLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  calcInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  calcUnit: {
    fontSize: 11,
    color: '#94a3b8',
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    marginTop: 6,
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
    backgroundColor: '#0f172a',
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
    backgroundColor: '#0f172a',
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
    marginTop: 6,
  },
  inputCell: {
    width: '48%',
  },
  saveSubmitBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveSubmitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  thinkingTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
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
