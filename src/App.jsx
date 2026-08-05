import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { safeStorage } from './shared_modules/storage/safeStorage.js';
import { nutritionDb } from './shared_modules/db/nutritionDb.js';
import { analyzeMealPhoto, analyzeMealTextWithAI } from './shared_modules/ai/nutritionAiService.js';
import { SECURE_WORKER_PROXY_URL } from './config/constants.js';
import { obsidianSyncService } from './shared_modules/obsidian/obsidianSyncService.js';

// 分割コンポーネント
import HistoryChartCard from './components/HistoryChartCard.native.jsx';
import NutritionSummaryCard from './components/NutritionSummaryCard.native.jsx';
import MealLogList from './components/MealLogList.native.jsx';
import PhotoRecordModal from './components/PhotoRecordModal.native.jsx';
import ChatRecordModal from './components/ChatRecordModal.native.jsx';
import HistorySelectModal from './components/HistorySelectModal.native.jsx';
import MdImportModal from './components/MdImportModal.native.jsx';
import EditMealLogModal from './components/EditMealLogModal.native.jsx';
import SettingsModal from './components/SettingsModal.native.jsx';

if (typeof window !== 'undefined' && FileSystem && FileSystem.StorageAccessFramework) {
  window.expoFileSystemSAF = { StorageAccessFramework: FileSystem.StorageAccessFramework };
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealLogs, setMealLogs] = useState([]);
  const [allHistoryLogs, setAllHistoryLogs] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // モーダル表示フラグ
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMdModalOpen, setIsMdModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState(null);

  // 解析・進捗
  const [analyzing, setAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [recordMode, setRecordMode] = useState('ocr'); // 'ocr' | 'dish'
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [portionMultiplier, setPortionMultiplier] = useState(1.0);
  const [portionPercentage, setPortionPercentage] = useState(100);

  // フォーム入力
  const [mealNameInput, setMealNameInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [sodiumInput, setSodiumInput] = useState('');
  const [fiberInput, setFiberInput] = useState('');
  const [mealType, setMealType] = useState('lunch');

  // チャット
  const [chatInput, setChatInput] = useState('');
  const [chatAnalyzing, setChatAnalyzing] = useState(false);
  const [chatAnalyzedData, setChatAnalyzedData] = useState(null);
  const [chatMealType, setChatMealType] = useState('lunch');

  // 編集
  const [editingMealLog, setEditingMealLog] = useState(null);
  const [editMealName, setEditMealName] = useState('');
  const [editMealType, setEditMealType] = useState('lunch');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editSodium, setEditSodium] = useState('');
  const [editFiber, setEditFiber] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // 履歴追加
  const [historyTargetMealType, setHistoryTargetMealType] = useState('lunch');

  // 設定 ＆ 目標
  const DEFAULT_TOLERANCES = {
    calories: { min: -10, max: 5 },
    protein: { min: -15, max: 20 },
    fat: { min: -15, max: 15 },
    carbs: { min: -15, max: 15 },
    sodium: { min: -100, max: 0 },
    fiber: { min: -15, max: 50 },
  };

  const [userGoals, setUserGoals] = useState({
    calories: 2200,
    protein: 75,
    fat: 60,
    carbs: 280,
    sodium: 7.0,
    fiber: 20.0,
    tolerances: DEFAULT_TOLERANCES
  });

  const [preferredAiModel, setPreferredAiModel] = useState('gemini');
  const [aiThinkingMode, setAiThinkingMode] = useState('quick');
  const [obsidianEnabled, setObsidianEnabled] = useState(false);
  const [obsidianVaultUri, setObsidianVaultUri] = useState('');
  const [obsidianSaveMode, setObsidianSaveMode] = useState('dedicated');
  const [obsidianFolderName, setObsidianFolderName] = useState('EIYOU');
  const [obsidianAutoSyncOnLaunch, setObsidianAutoSyncOnLaunch] = useState(true);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // データロード
  useEffect(() => {
    loadSettings();
    loadMealLogs();
    loadFavorites();
  }, [selectedDate]);

  const loadSettings = async () => {
    const savedGoals = await safeStorage.getItem('eiyou_user_goals', '');
    if (savedGoals) {
      try {
        setUserGoals(JSON.parse(savedGoals));
      } catch (e) {}
    }
    const savedModel = await safeStorage.getItem('eiyou_preferred_ai_model', 'gemini');
    setPreferredAiModel(savedModel);

    const savedThinking = await safeStorage.getItem('eiyou_ai_thinking_mode', 'quick');
    setAiThinkingMode(savedThinking);

    const obsConfig = await obsidianSyncService.getConfig();
    setObsidianEnabled(obsConfig.enabled);
    setObsidianVaultUri(obsConfig.vaultUri);
    setObsidianSaveMode(obsConfig.saveMode);
    setObsidianFolderName(obsConfig.folderName);
    setObsidianAutoSyncOnLaunch(obsConfig.autoSyncOnLaunch !== false);
  };

  const handleToggleThinkingMode = async (mode) => {
    setAiThinkingMode(mode);
    await safeStorage.setItem('eiyou_ai_thinking_mode', mode);
  };

  const loadMealLogs = async () => {
    const logs = await nutritionDb.getMealLogsByDate(selectedDate);
    setMealLogs(logs);
    const allLogs = await nutritionDb.getAllMealLogs();
    setAllHistoryLogs(allLogs);
  };

  const loadFavorites = async () => {
    const favs = await nutritionDb.getFavorites();
    setFavorites(favs);
  };

  // 栄養素合計の計算
  const totals = useMemo(() => {
    return mealLogs.reduce((acc, log) => {
      acc.calories += Number(log.calories) || 0;
      acc.protein += Number(log.protein) || 0;
      acc.fat += Number(log.fat) || 0;
      acc.carbs += Number(log.carbs) || 0;
      acc.sodium += Number(log.sodium) || 0;
      acc.fiber += Number(log.fiber) || 0;
      return acc;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0, fiber: 0 });
  }, [mealLogs]);

  // 日付変更
  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // 画像選択 ＆ AI解析
  const handleSelectImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('権限が必要', '写真を選択するにはストレージへのアクセス権限を許可してください。');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        let base64 = asset.base64;

        if (!base64) {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          base64 = manipulated.base64;
        }

        setSelectedImageUri(asset.uri);
        setBase64Image(base64);

        setAnalyzing(true);
        setProgressMsg('AI解析サーバーへ接続中...');

        const aiRes = await analyzeMealPhoto({
          base64Image: base64,
          workerProxyUrl: SECURE_WORKER_PROXY_URL,
          preferredModel: preferredAiModel,
          thinkingMode: aiThinkingMode,
          onProgress: (msg) => setProgressMsg(msg)
        });

        setAiAnalysisResult(aiRes);
        setMealNameInput(aiRes.mealName || '料理写真記録');
        setCaloriesInput(String(aiRes.calories || 0));
        setProteinInput(String(aiRes.protein || 0));
        setFatInput(String(aiRes.fat || 0));
        setCarbsInput(String(aiRes.carbs || 0));
        setSodiumInput(String(aiRes.sodium || 0));
        setFiberInput(String(aiRes.fiber || 0));
        setAnalyzing(false);
      }
    } catch (e) {
      setAnalyzing(false);
      Alert.alert('解析エラー', e.message || '写真の解析に失敗しました。');
    }
  };

  // 写真記録の保存
  const handleSavePhotoMeal = async () => {
    if (!mealNameInput.trim()) {
      Alert.alert('入力エラー', '食事・料理名を入力してください。');
      return;
    }
    const mult = recordMode === 'ocr' ? portionPercentage / 100 : portionMultiplier;

    await nutritionDb.addMealLog({
      date: selectedDate,
      mealType,
      name: mealNameInput,
      calories: Math.round((Number(caloriesInput) || 0) * mult),
      protein: Number(((Number(proteinInput) || 0) * mult).toFixed(1)),
      fat: Number(((Number(fatInput) || 0) * mult).toFixed(1)),
      carbs: Number(((Number(carbsInput) || 0) * mult).toFixed(1)),
      sodium: Number(((Number(sodiumInput) || 0) * mult).toFixed(1)),
      fiber: Number(((Number(fiberInput) || 0) * mult).toFixed(1)),
      photoUrl: selectedImageUri || '',
      memo: aiAnalysisResult?.advice || ''
    });

    setIsPhotoModalOpen(false);
    setSelectedImageUri(null);
    setBase64Image(null);
    setAiAnalysisResult(null);
    loadMealLogs();
  };

  // チャット解析
  const handleAnalyzeChat = async () => {
    if (!chatInput.trim()) return;
    setChatAnalyzing(true);
    try {
      const res = await analyzeMealTextWithAI({
        textInput: chatInput,
        workerProxyUrl: SECURE_WORKER_PROXY_URL,
        preferredModel: preferredAiModel,
        thinkingMode: aiThinkingMode
      });
      setChatAnalyzedData(res);
    } catch (e) {
      Alert.alert('解析エラー', e.message);
    } finally {
      setChatAnalyzing(false);
    }
  };

  // チャット記録保存
  const handleSaveChatMeal = async () => {
    if (!chatAnalyzedData) return;
    await nutritionDb.addMealLog({
      date: selectedDate,
      mealType: chatMealType,
      name: chatAnalyzedData.mealName || chatInput.substring(0, 20),
      calories: Number(chatAnalyzedData.calories) || 0,
      protein: Number(chatAnalyzedData.protein) || 0,
      fat: Number(chatAnalyzedData.fat) || 0,
      carbs: Number(chatAnalyzedData.carbs) || 0,
      sodium: Number(chatAnalyzedData.sodium) || 0,
      fiber: Number(chatAnalyzedData.fiber) || 0,
      memo: chatAnalyzedData.advice || ''
    });
    setIsChatModalOpen(false);
    setChatInput('');
    setChatAnalyzedData(null);
    loadMealLogs();
  };

  // 履歴・お気に入りからの追加
  const handleAddFromHistory = async (mealData) => {
    await nutritionDb.addMealLog({
      ...mealData,
      date: selectedDate
    });
    setIsHistoryModalOpen(false);
    loadMealLogs();
  };

  // MD一括保存
  const handleBatchSaveMd = async (selectedMeals) => {
    for (const item of selectedMeals) {
      await nutritionDb.addMealLog({
        date: item.date || selectedDate,
        mealType: item.mealType || 'lunch',
        name: item.name || '食事記録',
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        fat: Number(item.fat) || 0,
        carbs: Number(item.carbs) || 0,
        sodium: Number(item.sodium) || 0,
        fiber: Number(item.fiber) || 0,
        memo: item.memo || ''
      });
    }
    loadMealLogs();
  };

  // お気に入りトグル
  const handleToggleFavorite = async (mealData) => {
    await nutritionDb.toggleFavorite(mealData);
    loadFavorites();
  };

  // 食事削除
  const handleDeleteMeal = async (id) => {
    await nutritionDb.deleteMealLog(id);
    loadMealLogs();
  };

  // 食事編集開始
  const handleStartEditMeal = (log) => {
    setEditingMealLog(log);
    setEditMealName(log.name || '');
    setEditMealType(log.mealType || 'lunch');
    setEditCalories(String(log.calories ?? 0));
    setEditProtein(String(log.protein ?? 0));
    setEditFat(String(log.fat ?? 0));
    setEditCarbs(String(log.carbs ?? 0));
    setEditSodium(String(log.sodium ?? 0));
    setEditFiber(String(log.fiber ?? 0));
    setEditMemo(log.memo || '');
    setIsEditModalOpen(true);
  };

  // 食事編集保存
  const handleSaveEditMeal = async () => {
    if (!editingMealLog) return;
    await nutritionDb.updateMealLog(editingMealLog.id, {
      name: editMealName,
      mealType: editMealType,
      calories: Number(editCalories) || 0,
      protein: Number(editProtein) || 0,
      fat: Number(editFat) || 0,
      carbs: Number(editCarbs) || 0,
      sodium: Number(editSodium) || 0,
      fiber: Number(editFiber) || 0,
      memo: editMemo
    });
    setIsEditModalOpen(false);
    setEditingMealLog(null);
    loadMealLogs();
  };

  // 設定保存
  const handleSaveSettings = async () => {
    await safeStorage.setItem('eiyou_user_goals', JSON.stringify(userGoals));
    await safeStorage.setItem('eiyou_preferred_ai_model', preferredAiModel);
    await obsidianSyncService.saveConfig({
      enabled: obsidianEnabled,
      vaultUri: obsidianVaultUri,
      saveMode: obsidianSaveMode,
      folderName: obsidianFolderName,
      autoSyncOnLaunch: obsidianAutoSyncOnLaunch
    });
    setIsSettingsModalOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* ヘッダーバー */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>🍱 EIYOU <Text style={styles.appVersion}>v1.1</Text></Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setIsSettingsModalOpen(true)}>
          <Text style={styles.settingsBtnText}>⚙️ 設定</Text>
        </TouchableOpacity>
      </View>

      {/* 日付ナビゲーションバー */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrowText}>◀</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
          <Text style={styles.dateText}>📅 {selectedDate}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(1)}>
          <Text style={styles.dateArrowText}>▶</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {/* 1. 今日の栄養サマリー ＆ カロリー/PFC/塩分/食物繊維進捗バー */}
        <NutritionSummaryCard totals={totals} userGoals={userGoals} mealLogs={mealLogs} />

        {/* 食事追加アクションボタン群 */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]} onPress={() => setIsPhotoModalOpen(true)}>
            <Text style={styles.actionBtnText}>📷 写真記録</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => setIsChatModalOpen(true)}>
            <Text style={styles.actionBtnText}>💬 AIチャット</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]} onPress={() => setIsMdModalOpen(true)}>
            <Text style={styles.actionBtnText}>📋 MD一括</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]} onPress={() => setIsHistoryModalOpen(true)}>
            <Text style={styles.actionBtnText}>⭐ 履歴から</Text>
          </TouchableOpacity>
        </View>

        {/* 2. 食事ログ一覧カード */}
        <MealLogList
          mealLogs={mealLogs}
          favorites={favorites}
          onDeleteMeal={handleDeleteMeal}
          onEditMeal={handleStartEditMeal}
          onToggleFavorite={handleToggleFavorite}
          onPreviewPhoto={(url) => setSelectedPreviewPhoto(url)}
        />

        {/* 3. 栄養摂取推移グラフ */}
        <HistoryChartCard allLogs={allHistoryLogs} userGoals={userGoals} />
      </ScrollView>

      {/* --- モーダル群 --- */}
      <PhotoRecordModal
        visible={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        analyzing={analyzing}
        progressMsg={progressMsg}
        recordMode={recordMode}
        setRecordMode={setRecordMode}
        selectedImageUri={selectedImageUri}
        aiAnalysisResult={aiAnalysisResult}
        mealNameInput={mealNameInput}
        setMealNameInput={setMealNameInput}
        caloriesInput={caloriesInput}
        setCaloriesInput={setCaloriesInput}
        proteinInput={proteinInput}
        setProteinInput={setProteinInput}
        fatInput={fatInput}
        setFatInput={setFatInput}
        carbsInput={carbsInput}
        setCarbsInput={setCarbsInput}
        sodiumInput={sodiumInput}
        setSodiumInput={setSodiumInput}
        fiberInput={fiberInput}
        setFiberInput={setFiberInput}
        mealType={mealType}
        setMealType={setMealType}
        portionMultiplier={portionMultiplier}
        setPortionMultiplier={setPortionMultiplier}
        portionPercentage={portionPercentage}
        setPortionPercentage={setPortionPercentage}
        aiThinkingMode={aiThinkingMode}
        onToggleThinkingMode={handleToggleThinkingMode}
        onSelectImage={handleSelectImage}
        onSaveMeal={handleSavePhotoMeal}
      />

      <ChatRecordModal
        visible={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatAnalyzing={chatAnalyzing}
        chatAnalyzedData={chatAnalyzedData}
        chatMealType={chatMealType}
        setChatMealType={setChatMealType}
        aiThinkingMode={aiThinkingMode}
        onToggleThinkingMode={handleToggleThinkingMode}
        onAnalyzeChat={handleAnalyzeChat}
        onSaveChatMeal={handleSaveChatMeal}
      />

      <HistorySelectModal
        visible={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        allHistoryLogs={allHistoryLogs}
        favorites={favorites}
        historyTargetMealType={historyTargetMealType}
        setHistoryTargetMealType={setHistoryTargetMealType}
        onAddFromHistory={handleAddFromHistory}
        onPreviewPhoto={(url) => setSelectedPreviewPhoto(url)}
      />

      <MdImportModal
        visible={isMdModalOpen}
        onClose={() => setIsMdModalOpen(false)}
        selectedDate={selectedDate}
        onBatchSave={handleBatchSaveMd}
      />

      <EditMealLogModal
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editMealName={editMealName}
        setEditMealName={setEditMealName}
        editMealType={editMealType}
        setEditMealType={setEditMealType}
        editCalories={editCalories}
        setEditCalories={setEditCalories}
        editProtein={editProtein}
        setEditProtein={setEditProtein}
        editFat={editFat}
        setEditFat={setEditFat}
        editCarbs={editCarbs}
        setEditCarbs={setEditCarbs}
        editSodium={editSodium}
        setEditSodium={setEditSodium}
        editFiber={editFiber}
        setEditFiber={setEditFiber}
        editMemo={editMemo}
        setEditMemo={setEditMemo}
        onSaveEdit={handleSaveEditMeal}
      />

      <SettingsModal
        visible={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userGoals={userGoals}
        setUserGoals={setUserGoals}
        preferredAiModel={preferredAiModel}
        setPreferredAiModel={setPreferredAiModel}
        obsidianEnabled={obsidianEnabled}
        setObsidianEnabled={setObsidianEnabled}
        obsidianVaultUri={obsidianVaultUri}
        setObsidianVaultUri={setObsidianVaultUri}
        obsidianSaveMode={obsidianSaveMode}
        setObsidianSaveMode={setObsidianSaveMode}
        obsidianFolderName={obsidianFolderName}
        setObsidianFolderName={setObsidianFolderName}
        obsidianAutoSyncOnLaunch={obsidianAutoSyncOnLaunch}
        setObsidianAutoSyncOnLaunch={setObsidianAutoSyncOnLaunch}
        syncStatusMsg={syncStatusMsg}
        setSyncStatusMsg={setSyncStatusMsg}
        onSaveSettings={handleSaveSettings}
      />

      {/* 写真プレビューモーダル */}
      {Boolean(selectedPreviewPhoto) && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity
            style={styles.photoPreviewOverlay}
            activeOpacity={1}
            onPress={() => setSelectedPreviewPhoto(null)}
          >
            <Image source={{ uri: selectedPreviewPhoto }} style={styles.fullImagePreview} resizeMode="contain" />
            <Text style={styles.closePreviewHint}>タップで閉じる</Text>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  appVersion: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  settingsBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingsBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  dateBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
  },
  dateArrowBtn: {
    padding: 8,
  },
  dateArrowText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  mainScroll: {
    padding: 16,
    paddingBottom: 32,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImagePreview: {
    width: '90%',
    height: '75%',
  },
  closePreviewHint: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 12,
  },
});
