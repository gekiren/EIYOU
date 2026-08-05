import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Updates from 'expo-updates';
import { exportMealsToCSV } from '../shared_modules/csv/nutritionCsvService.js';
import { obsidianSyncService } from '../shared_modules/obsidian/obsidianSyncService.js';
import { calculateTargetGoals } from '../utils/nutritionCalculator.js';

export default function SettingsModal({
  visible,
  onClose,
  userGoals = {},
  setUserGoals = () => {},
  handleToleranceChange = () => {},
  preferredAiModel,
  setPreferredAiModel,
  obsidianEnabled,
  setObsidianEnabled,
  obsidianVaultUri,
  setObsidianVaultUri,
  obsidianSaveMode,
  setObsidianSaveMode,
  obsidianFolderName,
  setObsidianFolderName,
  obsidianAutoSyncOnLaunch,
  setObsidianAutoSyncOnLaunch,
  syncStatusMsg,
  setSyncStatusMsg,
  autophagyConfig = {},
  setAutophagyConfig = () => {},
  onSaveSettings
}) {
  const [activeTab, setActiveTab] = useState('goals'); // 'goals' | 'updates' | 'obsidian' | 'data'
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [otaStatusMsg, setOtaStatusMsg] = useState('');

  // BMR / TDEE 計算用フォームステート
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('65');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goalType, setGoalType] = useState('maintain');

  // 計算結果プレビュー
  const calculatedGoals = useMemo(() => {
    return calculateTargetGoals({
      gender,
      age: Number(age) || 30,
      height: Number(height) || 170,
      weight: Number(weight) || 65,
      activityLevel,
      goalType
    });
  }, [gender, age, height, weight, activityLevel, goalType]);

  // 目標値への自動適用
  const handleApplyCalculatedGoals = () => {
    setUserGoals({
      ...userGoals,
      calories: calculatedGoals.calories,
      protein: calculatedGoals.protein,
      fat: calculatedGoals.fat,
      carbs: calculatedGoals.carbs,
      sodium: calculatedGoals.sodium,
      fiber: calculatedGoals.fiber
    });
    Alert.alert('🎉 目標を更新', 'BMR / TDEE 電卓で計算された目標値（カロリー・PFC・塩分・食物繊維）を適用しました！');
  };

  if (!visible) return null;

  // OTA 手動更新チェック
  const handleCheckOtaUpdate = async () => {
    setCheckingUpdate(true);
    setOtaStatusMsg('🔍 最新アップデートを確認中...');
    try {
      if (!Updates.isEnabled) {
        setOtaStatusMsg('ℹ️ 開発環境（Expo Go）ではOTA更新チェックは利用できません。');
        setCheckingUpdate(false);
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setOtaStatusMsg('🎉 新しいアップデートが見つかりました！ダウンロード中...');
        await Updates.fetchUpdateAsync();
        setOtaStatusMsg('✅ ダウンロードが完了しました。');
        Alert.alert(
          'アップデート完了',
          '最新バージョンのダウンロードが完了しました。アプリを再起動して適用しますか？',
          [
            { text: '後で', style: 'cancel' },
            { text: '今すぐ再起動', onPress: () => Updates.reloadAsync() }
          ]
        );
      } else {
        setOtaStatusMsg('✨ お使いのアプリは最新状態です。');
      }
    } catch (e) {
      setOtaStatusMsg(`⚠️ 確認エラー: ${e.message || '更新の確認に失敗しました。'}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // OTA 手動再起動適用
  const handleForceReloadOta = async () => {
    try {
      if (Updates.isEnabled && Updates.reloadAsync) {
        await Updates.reloadAsync();
      } else {
        Alert.alert('通知', '開発環境ではアプリの再起動機能はサポートされていません。');
      }
    } catch (e) {
      Alert.alert('エラー', e.message);
    }
  };

  const handleManualObsidianSync = async () => {
    setSyncStatusMsg('Obsidianへ同期中...');
    try {
      const res = await obsidianSyncService.syncAllMealLogs(userGoals);
      if (res.success) {
        setSyncStatusMsg(`✅ 同期完了 (${res.count || 1}件のノートを更新)`);
      } else {
        setSyncStatusMsg(`⚠️ 同期スキップ: ${res.reason}`);
      }
    } catch (e) {
      setSyncStatusMsg(`❌ エラー: ${e.message}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>⚙️ アプリ設定 ＆ データ管理</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* タブ切り替え（4タブ構成） */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'goals' && styles.activeTab]}
              onPress={() => setActiveTab('goals')}
            >
              <Text style={[styles.tabText, activeTab === 'goals' && styles.activeTabText]}>🎯 目標・AI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'updates' && styles.activeTab]}
              onPress={() => setActiveTab('updates')}
            >
              <Text style={[styles.tabText, activeTab === 'updates' && styles.activeTabText]}>🔄 OTA・更新</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'obsidian' && styles.activeTab]}
              onPress={() => setActiveTab('obsidian')}
            >
              <Text style={[styles.tabText, activeTab === 'obsidian' && styles.activeTabText]}>💎 Obsidian</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'data' && styles.activeTab]}
              onPress={() => setActiveTab('data')}
            >
              <Text style={[styles.tabText, activeTab === 'data' && styles.activeTabText]}>💾 CSVデータ</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* 1. 目標 ＆ AIモデル設定タブ */}
            {activeTab === 'goals' && (
              <>
                {/* AIモデル選択 */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🤖 優先AIモデル選択</Text>
                  <View style={styles.aiModelRow}>
                    <TouchableOpacity
                      style={[styles.modelBtn, preferredAiModel === 'gemini' && styles.activeModelBtn]}
                      onPress={() => setPreferredAiModel('gemini')}
                    >
                      <Text style={[styles.modelBtnText, preferredAiModel === 'gemini' && styles.activeModelBtnText]}>
                        ✨ Gemini 3.6 Flash (標準)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modelBtn, preferredAiModel === 'deepseek' && styles.activeModelBtn]}
                      onPress={() => setPreferredAiModel('deepseek')}
                    >
                      <Text style={[styles.modelBtnText, preferredAiModel === 'deepseek' && styles.activeModelBtnText]}>
                        ⚡ DeepSeek V4 (高速)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* オートファジー目標時間 ＆ 通知設定 */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>⌛ オートファジー絶食目標設定</Text>
                  <Text style={styles.guideText}>
                    設定した時間（例: 16時間）経過した際にオートファジー目標達成通知を発行します。
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>目標絶食時間 (時間)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={[styles.textInput, { width: 70, textAlign: 'center', fontWeight: '700', fontSize: 16 }]}
                        keyboardType="numeric"
                        value={String(autophagyConfig.targetHours || 16)}
                        onChangeText={(val) => {
                          const num = parseInt(val, 10);
                          setAutophagyConfig({
                            ...autophagyConfig,
                            targetHours: isNaN(num) || num <= 0 ? 16 : num,
                          });
                        }}
                      />
                      <Text style={{ fontSize: 14, marginLeft: 6, color: '#666', fontWeight: '600' }}>時間</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>オートファジー絶食監視</Text>
                      <Text style={{ fontSize: 11, color: '#777', marginTop: 2 }}>ONにするとタイマー計測と通知が有効になります</Text>
                    </View>
                    <Switch
                      value={!!autophagyConfig.enabled}
                      onValueChange={(val) => {
                        setAutophagyConfig({
                          ...autophagyConfig,
                          enabled: val,
                          startTime: val ? (autophagyConfig.startTime || new Date().toISOString()) : autophagyConfig.startTime,
                        });
                      }}
                      trackColor={{ false: '#e0e0e0', true: '#c8e6c9' }}
                      thumbColor={autophagyConfig.enabled ? '#4caf50' : '#9e9e9e'}
                    />
                  </View>
                </View>

                {/* BMR / TDEE 自動計算電卓モジュール */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🧮 BMR / TDEE 目標自動計算電卓</Text>
                  <Text style={styles.guideText}>
                    性別・身体情報・活動度を入力すると、BMR (基礎代謝) と TDEE (総消費カロリー) から最適な栄養目標を自動算定します。
                  </Text>

                  {/* 性別選択 */}
                  <Text style={styles.fieldLabel}>性別</Text>
                  <View style={styles.selectorRow}>
                    <TouchableOpacity
                      style={[styles.selectorBtn, gender === 'male' && styles.activeSelectorBtn]}
                      onPress={() => setGender('male')}
                    >
                      <Text style={[styles.selectorText, gender === 'male' && styles.activeSelectorText]}>👨 男性</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.selectorBtn, gender === 'female' && styles.activeSelectorBtn]}
                      onPress={() => setGender('female')}
                    >
                      <Text style={[styles.selectorText, gender === 'female' && styles.activeSelectorText]}>👩 女性</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 身体情報 (年齢 / 身長 / 体重) */}
                  <View style={styles.inputGrid}>
                    <View style={styles.inputCellThird}>
                      <Text style={styles.fieldLabel}>年齢 (歳)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={age}
                        onChangeText={setAge}
                      />
                    </View>
                    <View style={styles.inputCellThird}>
                      <Text style={styles.fieldLabel}>身長 (cm)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={height}
                        onChangeText={setHeight}
                      />
                    </View>
                    <View style={styles.inputCellThird}>
                      <Text style={styles.fieldLabel}>体重 (kg)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={weight}
                        onChangeText={setWeight}
                      />
                    </View>
                  </View>

                  {/* 活動レベル */}
                  <Text style={styles.fieldLabel}>日常生活の活動レベル</Text>
                  <View style={styles.selectOptionList}>
                    {[
                      { key: 'sedentary', label: 'ほぼ運動しない (デスクワーク)' },
                      { key: 'light', label: '軽い運動 / 立ち仕事 (週1-3日)' },
                      { key: 'moderate', label: '適度な運動 (週3-5日)' },
                      { key: 'active', label: '活発な運動 (週6-7日)' },
                      { key: 'veryActive', label: '非常に激しい運動 / アスリート' },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.optionChip, activityLevel === opt.key && styles.activeOptionChip]}
                        onPress={() => setActivityLevel(opt.key)}
                      >
                        <Text style={[styles.optionChipText, activityLevel === opt.key && styles.activeOptionChipText]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 目的 (減量 / 維持 / 増量) */}
                  <Text style={styles.fieldLabel}>目的・ターゲット</Text>
                  <View style={styles.selectorRow}>
                    {[
                      { key: 'cut', label: '🔥 減量 (-15%)' },
                      { key: 'maintain', label: '⚖️ 維持 (0%)' },
                      { key: 'bulk', label: '💪 増量 (+10%)' },
                    ].map((g) => (
                      <TouchableOpacity
                        key={g.key}
                        style={[styles.selectorBtn, goalType === g.key && styles.activeSelectorBtn]}
                        onPress={() => setGoalType(g.key)}
                      >
                        <Text style={[styles.selectorText, goalType === g.key && styles.activeSelectorText]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 計算結果プレビューボックス */}
                  <View style={styles.calcPreviewBox}>
                    <View style={styles.calcStatRow}>
                      <Text style={styles.calcStatItem}>BMR: <Text style={styles.calcHighlight}>{calculatedGoals.bmr}</Text> kcal</Text>
                      <Text style={styles.calcStatItem}>TDEE: <Text style={styles.calcHighlight}>{calculatedGoals.tdee}</Text> kcal</Text>
                    </View>

                    <View style={styles.calcGoalDetailBox}>
                      <Text style={styles.calcTargetTitle}>🎯 推奨目標値</Text>
                      <Text style={styles.calcTargetMain}>
                        {calculatedGoals.calories} <Text style={styles.subUnit}>kcal/日</Text>
                      </Text>
                      <Text style={styles.calcPfcSub}>
                        P: {calculatedGoals.protein}g | F: {calculatedGoals.fat}g | C: {calculatedGoals.carbs}g | 塩分: {calculatedGoals.sodium}g
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.applyGoalsBtn} onPress={handleApplyCalculatedGoals}>
                      <Text style={styles.applyGoalsBtnText}>✨ この計算結果を1日の目標に反映する</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 1日の目標摂取量フォーム (直接入力・編集可能) */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🎯 1日の目標摂取量 (直接編集)</Text>
                  <View style={styles.inputGrid}>
                    <View style={styles.inputCell}>
                      <Text style={styles.fieldLabel}>目標カロリー (kcal)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(userGoals.calories || 2200)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, calories: Number(val) || 0 })}
                      />
                    </View>
                    <View style={styles.inputCell}>
                      <Text style={styles.fieldLabel}>タンパク質 (g)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(userGoals.protein || 75)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, protein: Number(val) || 0 })}
                      />
                    </View>
                    <View style={styles.inputCell}>
                      <Text style={styles.fieldLabel}>脂質 (g)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(userGoals.fat || 60)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, fat: Number(val) || 0 })}
                      />
                    </View>
                    <View style={styles.inputCell}>
                      <Text style={styles.fieldLabel}>炭水化物 (g)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(userGoals.carbs || 280)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, carbs: Number(val) || 0 })}
                      />
                    </View>
                    <View style={styles.inputCell}>
                      <Text style={styles.fieldLabel}>塩分相当量 (g)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(userGoals.sodium || 7.0)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, sodium: Number(val) || 0 })}
                      />
                    </View>
                    <View style={styles.inputCell}>
                      <Text style={styles.fieldLabel}>食物繊維 (g)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={String(userGoals.fiber || 20.0)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, fiber: Number(val) || 0 })}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* 2. OTA アプリ更新タブ */}
            {activeTab === 'updates' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>📲 アプリのOTA更新（EAS Update）</Text>
                <Text style={styles.guideText}>
                  ストア経由の再インストールなしで、最新のバグ修正や機能改善プログラムを直接ダウンロード適用します。
                </Text>

                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>📌 チャンネル/ブランチ: <Text style={styles.infoVal}>{Updates.channel || 'staging'}</Text></Text>
                  <Text style={styles.infoText}>📌 Runtime Version: <Text style={styles.infoVal}>{Updates.runtimeVersion || '1.0.0'}</Text></Text>
                  <Text style={styles.infoText}>📌 Update ID: <Text style={styles.infoVal}>{Updates.updateId ? Updates.updateId.substring(0, 8) + '...' : '最新/ローカル'}</Text></Text>
                </View>

                {Boolean(otaStatusMsg) && (
                  <View style={styles.statusBox}>
                    <Text style={styles.statusText}>{otaStatusMsg}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.otaCheckBtn, checkingUpdate && styles.disabledBtn]}
                  onPress={handleCheckOtaUpdate}
                  disabled={checkingUpdate}
                >
                  {checkingUpdate ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.otaCheckBtnText}>🔍 最新アップデートを確認・取得</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.reloadBtn} onPress={handleForceReloadOta}>
                  <Text style={styles.reloadBtnText}>⚡ 今すぐアプリを再起動して適用</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 3. Obsidian 連携タブ */}
            {activeTab === 'obsidian' && (
              <View style={styles.sectionCard}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Obsidian Vault 自動同期を有効化</Text>
                  <Switch
                    value={obsidianEnabled}
                    onValueChange={setObsidianEnabled}
                    trackColor={{ false: '#334155', true: '#10b981' }}
                  />
                </View>

                {obsidianEnabled && (
                  <>
                    <Text style={styles.fieldLabel}>Vault 保存モード</Text>
                    <View style={styles.modeRow}>
                      {[
                        { key: 'dedicated', label: '日別独立' },
                        { key: 'append', label: 'デイリー追記' },
                        { key: 'individual', label: '単一集約' }
                      ].map(m => (
                        <TouchableOpacity
                          key={m.key}
                          style={[styles.modeBtn, obsidianSaveMode === m.key && styles.activeModeBtn]}
                          onPress={() => setObsidianSaveMode(m.key)}
                        >
                          <Text style={[styles.modeBtnText, obsidianSaveMode === m.key && styles.activeModeBtnText]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>フォルダ名</Text>
                    <TextInput
                      style={styles.textInput}
                      value={obsidianFolderName}
                      onChangeText={setObsidianFolderName}
                    />

                    <View style={styles.switchRow}>
                      <Text style={styles.switchLabel}>アプリ起動時に自動同期する</Text>
                      <Switch
                        value={obsidianAutoSyncOnLaunch}
                        onValueChange={setObsidianAutoSyncOnLaunch}
                        trackColor={{ false: '#334155', true: '#10b981' }}
                      />
                    </View>

                    {Boolean(syncStatusMsg) && (
                      <Text style={styles.statusMsg}>{syncStatusMsg}</Text>
                    )}

                    <TouchableOpacity style={styles.syncNowBtn} onPress={handleManualObsidianSync}>
                      <Text style={styles.syncNowBtnText}>🔄 今すぐObsidianへ一括同期</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* 4. CSVデータ出入力タブ */}
            {activeTab === 'data' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>📂 CSVエクスポート・バックアップ</Text>
                <Text style={styles.guideText}>
                  すべての食事ログ・PFC・食物繊維データをCSV形式で出力・バックアップします。
                </Text>
                <TouchableOpacity style={styles.csvExportBtn} onPress={exportMealsToCSV}>
                  <Text style={styles.csvExportBtnText}>📥 食事ログをCSVダウンロード</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 保存ボタン */}
            <TouchableOpacity style={styles.saveSettingsBtn} onPress={onSaveSettings}>
              <Text style={styles.saveSettingsBtnText}>💾 設定を保存して閉じる</Text>
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
    maxHeight: '92%',
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
  },
  tabText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#10b981',
    fontWeight: '700',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  guideText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
  },
  aiModelRow: {
    gap: 8,
  },
  modelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeModelBtn: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
  },
  modelBtnText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activeModelBtnText: {
    color: '#10b981',
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputCell: {
    width: '48%',
  },
  inputCellThird: {
    width: '31%',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeSelectorBtn: {
    backgroundColor: '#3b82f622',
    borderColor: '#3b82f6',
  },
  selectorText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activeSelectorText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  selectOptionList: {
    gap: 6,
    marginVertical: 4,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeOptionChip: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
  },
  optionChipText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  activeOptionChipText: {
    color: '#10b981',
    fontWeight: '700',
  },
  calcPreviewBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#3b82f644',
  },
  calcStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  calcStatItem: {
    fontSize: 12,
    color: '#94a3b8',
  },
  calcHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  calcGoalDetailBox: {
    alignItems: 'center',
    marginVertical: 4,
  },
  calcTargetTitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  calcTargetMain: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10b981',
    marginVertical: 2,
  },
  subUnit: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '400',
  },
  calcPfcSub: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  applyGoalsBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  applyGoalsBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  infoBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  infoVal: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  statusBox: {
    backgroundColor: '#0369a122',
    borderColor: '#0284c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  otaCheckBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  otaCheckBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  reloadBtn: {
    backgroundColor: '#0f172a',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reloadBtnText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 12,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  switchLabel: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 6,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeModeBtn: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
  },
  modeBtnText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  activeModeBtnText: {
    color: '#10b981',
    fontWeight: '700',
  },
  statusMsg: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 8,
  },
  syncNowBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  syncNowBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  csvExportBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  csvExportBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  saveSettingsBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveSettingsBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
