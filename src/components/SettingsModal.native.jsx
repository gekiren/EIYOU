import React, { useState } from 'react';
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
  onSaveSettings
}) {
  const [activeTab, setActiveTab] = useState('goals'); // 'goals' | 'updates' | 'obsidian' | 'data'
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [otaStatusMsg, setOtaStatusMsg] = useState('');

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

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>🎯 1日の目標摂取量</Text>
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
            )}

            {/* 2. OTA アプリ更新タブ [復元 ＆ 機能拡張] */}
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
  guideText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
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
