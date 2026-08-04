import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  ActivityIndicator,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Updates from 'expo-updates';
import { safeStorage } from './shared_modules/storage/safeStorage.js';
import { nutritionDb } from './shared_modules/db/nutritionDb.js';
import { analyzeMealPhoto, analyzeMealTextWithAI } from './shared_modules/ai/nutritionAiService.js';
import { SECURE_WORKER_PROXY_URL } from './config/constants.js';
import { obsidianSyncService } from './shared_modules/obsidian/obsidianSyncService.js';
import { parseMealMarkdown } from './shared_modules/md/markdownMealParser.js';
import HistoryChartCard from './components/HistoryChartCard.native.jsx';


if (typeof window !== 'undefined' && FileSystem && FileSystem.StorageAccessFramework) {
  window.expoFileSystemSAF = { StorageAccessFramework: FileSystem.StorageAccessFramework };
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealLogs, setMealLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // モーダル
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMdModalOpen, setIsMdModalOpen] = useState(false);
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState(null); // 写真フルスクリーンプレビュー用

  // MD一括取り込み用ステート
  const [mdInput, setMdInput] = useState('');
  const [mdParsedMeals, setMdParsedMeals] = useState(null);
  const [mdSelectedIndices, setMdSelectedIndices] = useState([]);
  const [showMdGuide, setShowMdGuide] = useState(false);
  const [mdErrorMsg, setMdErrorMsg] = useState('');

  // 履歴追加用ステート
  const [allHistoryLogs, setAllHistoryLogs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyTab, setHistoryTab] = useState('favorites'); // 'favorites' | 'recent' | 'frequent' | 'breakfast' | 'lunch' | 'dinner' | 'snack'
  const [historyTargetMealType, setHistoryTargetMealType] = useState('lunch');
  const [historyMultiplier, setHistoryMultiplier] = useState(1.0);

  // 編集モーダル用ステート
  const [editingMealLog, setEditingMealLog] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMealName, setEditMealName] = useState('');
  const [editMealType, setEditMealType] = useState('lunch');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editSodium, setEditSodium] = useState('');
  const [editFiber, setEditFiber] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // 記録モード ('ocr' | 'dish' | 'manual')
  const [recordMode, setRecordMode] = useState('ocr');

  // 写真 ＆ プレビューデータ
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);

  // 量の調整用
  const [portionMultiplier, setPortionMultiplier] = useState(1.0); // 料理モード用 (0.5 ~ 3.0倍)
  const [portionPercentage, setPortionPercentage] = useState(100); // OCRモード用 (10% ~ 200%)

  // 手動 / 入力項目
  const [chatInput, setChatInput] = useState('');
  const [chatAnalyzing, setChatAnalyzing] = useState(false);
  const [chatAnalyzedData, setChatAnalyzedData] = useState(null);
  const [chatMealType, setChatMealType] = useState('lunch');
  const [chatFollowUpInput, setChatFollowUpInput] = useState(''); // フェーズ2の追加チャット入力
  const [chatFollowUpAnalyzing, setChatFollowUpAnalyzing] = useState(false); // 追加チャット解析中
  const [chatMessages, setChatMessages] = useState([]); // 会話履歴
  const [mealNameInput, setMealNameInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [sodiumInput, setSodiumInput] = useState('');
  const [fiberInput, setFiberInput] = useState('');
  const [mealType, setMealType] = useState('lunch');

  // 目標達成許容範囲のデフォルト値
  const DEFAULT_TOLERANCES = {
    calories: { min: -10, max: 5 },
    protein: { min: -15, max: 20 },
    fat: { min: -15, max: 15 },
    carbs: { min: -15, max: 15 },
    sodium: { min: -100, max: 0 },
    fiber: { min: -15, max: 50 },
  };

  // 目標設定
  const [userGoals, setUserGoals] = useState({
    calories: 2200,
    protein: 75,
    fat: 60,
    carbs: 280,
    sodium: 7.0,
    fiber: 20.0,
    tolerances: DEFAULT_TOLERANCES
  });

  // 目標設定モード & PFC比率ステート (Native)
  const [goalMode, setGoalMode] = useState('calorie_pfc'); // 'calorie_pfc' | 'pfc_gram' | 'protein_pfc'
  const [pRatio, setPRatio] = useState(30);
  const [fRatio, setFRatio] = useState(20);
  const [cRatio, setCRatio] = useState(50);

  // 許容範囲 (-% 〜 +%) 変更用ハンドラー
  const handleToleranceChange = (nutrientKey, minOrMax, value) => {
    const num = Number(value);
    const updated = {
      ...userGoals,
      tolerances: {
        ...DEFAULT_TOLERANCES,
        ...(userGoals.tolerances || {}),
        [nutrientKey]: {
          ...(userGoals.tolerances?.[nutrientKey] || DEFAULT_TOLERANCES[nutrientKey]),
          [minOrMax]: isNaN(num) ? 0 : num
        }
      }
    };
    setUserGoals(updated);
    safeStorage.setItem('eiyou_user_goals', JSON.stringify(updated));
  };

  // AIモデル選択ステート ('gemini' | 'deepseek')
  const [preferredAiModel, setPreferredAiModel] = useState('gemini');

  // Obsidian 連携ステート
  const [obsidianEnabled, setObsidianEnabled] = useState(false);
  const [obsidianVaultUri, setObsidianVaultUri] = useState('');
  const [obsidianSaveMode, setObsidianSaveMode] = useState('dedicated'); // 'dedicated' | 'append' | 'individual'
  const [obsidianFolderName, setObsidianFolderName] = useState('EIYOU');
  const [obsidianAutoSyncOnLaunch, setObsidianAutoSyncOnLaunch] = useState(true);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [settingsTab, setSettingsTab] = useState('goals'); // 'goals' | 'obsidian' | 'data'

  useEffect(() => {
    loadSettings();
    loadMealLogs();
    loadFavorites();

    // Obsidian 起動時自動同期
    obsidianSyncService.getConfig().then(cfg => {
      if (cfg.enabled && cfg.autoSyncOnLaunch !== false) {
        obsidianSyncService.syncAllMealLogs(userGoals).catch(e => {
          console.warn('[ObsidianSync] Native launch auto sync failed:', e);
        });
      }
    });
  }, [selectedDate]);

  const updateRatiosFromGoals = (goals) => {
    const cal = Number(goals.calories) || 0;
    const p = Number(goals.protein) || 0;
    const f = Number(goals.fat) || 0;
    if (cal > 0) {
      const pr = Math.round(((p * 4) / cal) * 100);
      const fr = Math.round(((f * 9) / cal) * 100);
      const cr = 100 - pr - fr;
      setPRatio(pr > 0 ? pr : 30);
      setFRatio(fr > 0 ? fr : 20);
      setCRatio(cr > 0 ? cr : 50);
    }
  };

  const loadSettings = async () => {
    const savedGoals = await safeStorage.getItem('eiyou_user_goals', '');
    if (savedGoals) {
      try {
        const parsed = JSON.parse(savedGoals);
        const mergedGoals = {
          calories: 2200,
          protein: 75,
          fat: 60,
          carbs: 280,
          sodium: 7.0,
          ...parsed,
          tolerances: {
            ...DEFAULT_TOLERANCES,
            ...(parsed.tolerances || {})
          }
        };
        setUserGoals(mergedGoals);
        updateRatiosFromGoals(mergedGoals);
      } catch (e) {}
    } else {
      updateRatiosFromGoals(userGoals);
    }
    const savedModel = await safeStorage.getItem('eiyou_preferred_ai_model', 'gemini');
    if (savedModel) {
      setPreferredAiModel(savedModel);
    }

    const cfg = await obsidianSyncService.getConfig();
    setObsidianEnabled(cfg.enabled || false);
    setObsidianVaultUri(cfg.vaultUri || '');
    setObsidianSaveMode(cfg.saveMode || 'dedicated');
    setObsidianFolderName(cfg.folderName || 'EIYOU');
    setObsidianAutoSyncOnLaunch(cfg.autoSyncOnLaunch !== false);
  };

  // モード1: カロリー ＆ PFC% 指定の計算 (Native)
  const handleCalorieAndRatioChangeNative = (newCal, newP, newF, newC) => {
    const cal = newCal !== undefined ? (Number(newCal) || 0) : userGoals.calories;
    const pr = newP !== undefined ? (Number(newP) || 0) : pRatio;
    const fr = newF !== undefined ? (Number(newF) || 0) : fRatio;
    const cr = newC !== undefined ? (Number(newC) || 0) : cRatio;

    if (newP !== undefined) setPRatio(pr);
    if (newF !== undefined) setFRatio(fr);
    if (newC !== undefined) setCRatio(cr);

    const pG = Math.round((cal * (pr / 100)) / 4);
    const fG = Math.round((cal * (fr / 100)) / 9);
    const cG = Math.round((cal * (cr / 100)) / 4);

    setUserGoals({
      ...userGoals,
      calories: cal,
      protein: pG,
      fat: fG,
      carbs: cG
    });
  };

  // モード2: PFC(g) 直接指定の計算 (Native)
  const handleGramChangeNative = (newP, newF, newC) => {
    const pG = newP !== undefined ? (Number(newP) || 0) : userGoals.protein;
    const fG = newF !== undefined ? (Number(newF) || 0) : userGoals.fat;
    const cG = newC !== undefined ? (Number(newC) || 0) : userGoals.carbs;

    const totalCal = Math.round(pG * 4 + fG * 9 + cG * 4);

    if (totalCal > 0) {
      const pr = Math.round(((pG * 4) / totalCal) * 100);
      const fr = Math.round(((fG * 9) / totalCal) * 100);
      const cr = 100 - pr - fr;
      setPRatio(pr);
      setFRatio(fr);
      setCRatio(cr);
    }

    setUserGoals({
      ...userGoals,
      calories: totalCal,
      protein: pG,
      fat: fG,
      carbs: cG
    });
  };

  // モード3: P(g) ＆ PFC% 指定の計算 (Native)
  const handleProteinAndRatioChangeNative = (newP, newPR, newFR, newCR) => {
    const pG = newP !== undefined ? (Number(newP) || 0) : userGoals.protein;
    const pr = newPR !== undefined ? (Number(newPR) || 0) : pRatio;
    const fr = newFR !== undefined ? (Number(newFR) || 0) : fRatio;
    const cr = newCR !== undefined ? (Number(newCR) || 0) : cRatio;

    if (newPR !== undefined) setPRatio(pr);
    if (newFR !== undefined) setFRatio(fr);
    if (newCR !== undefined) setCRatio(cr);

    const pCal = pG * 4;
    const totalCal = pr > 0 ? Math.round(pCal / (pr / 100)) : 0;
    const fG = Math.round((totalCal * (fr / 100)) / 9);
    const cG = Math.round((totalCal * (cr / 100)) / 4);

    setUserGoals({
      ...userGoals,
      calories: totalCal,
      protein: pG,
      fat: fG,
      carbs: cG
    });
  };

  const handleSelectVaultFolder = async () => {
    if (FileSystem && FileSystem.StorageAccessFramework) {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          setObsidianVaultUri(permissions.directoryUri);
          setSyncStatusMsg('Vault フォルダ権限を取得しました');
        }
      } catch (e) {
        Alert.alert('フォルダ選択エラー', e.message);
      }
    }
  };

  const handleManualSyncAll = async () => {
    setSyncStatusMsg('一括同期中...');
    try {
      const res = await obsidianSyncService.syncAllMealLogs(userGoals);
      if (res.success) {
        setSyncStatusMsg(`一括同期完了: ${res.count || 1}件を出力/更新しました。`);
        Alert.alert('同期完了', `${res.count || 1}件のノートをObsidianへエクスポートしました。`);
      } else {
        setSyncStatusMsg(`同期失敗: ${res.reason || '設定を確認してください'}`);
        Alert.alert('同期失敗', res.reason || '設定を確認してください');
      }
    } catch (e) {
      setSyncStatusMsg('同期エラー: ' + e.message);
    }
  };

  const loadMealLogs = async () => {
    setLoading(true);
    try {
      const [logs, allLogs] = await Promise.all([
        nutritionDb.getMealLogsByDate(selectedDate),
        nutritionDb.getAllMealLogs()
      ]);
      setMealLogs(logs || []);
      setAllHistoryLogs(allLogs || []);
    } catch (e) {
      console.error('Failed to load meal logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const favs = await nutritionDb.getFavorites();
      setFavorites(favs || []);
      return favs || [];
    } catch (e) {
      console.error('Failed to load favorites:', e);
      return [];
    }
  };

  const handleToggleFavorite = async (mealItem) => {
    const targetItem = {
      ...mealItem,
      mealType: mealItem?.mealType || historyTargetMealType || 'lunch'
    };
    await nutritionDb.toggleFavorite(targetItem);
    const [logs, favs] = await Promise.all([
      nutritionDb.getAllMealLogs(),
      loadFavorites()
    ]);
    setAllHistoryLogs(logs || []);
  };

  const handleOpenHistoryModal = async () => {
    setHistoryMultiplier(1.0);
    try {
      const [logs, favs] = await Promise.all([
        nutritionDb.getAllMealLogs(),
        loadFavorites()
      ]);
      setAllHistoryLogs(logs || []);
      if ((!favs || favs.length === 0) && historyTab === 'favorites') {
        setHistoryTab('recent');
      }
    } catch (e) {
      console.error('Failed to load history meal logs:', e);
    }
    setIsHistoryModalOpen(true);
  };

  // 画像URIから確実にBase64を取得
  const convertUriToBase64 = async (uri, base64FromPicker) => {
    if (base64FromPicker && base64FromPicker.length > 200) {
      return `data:image/jpeg;base64,${base64FromPicker}`;
    }
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      return `data:image/jpeg;base64,${b64}`;
    } catch (e) {
      console.error('FileSystem readAsStringAsync failed:', e);
      return null;
    }
  };

  // 料理写真の永続ディレクトリ保存処理 (OSキャッシュ削除対策)
  const saveMealPhotoToPermanentStorage = async (tempUri) => {
    if (!tempUri) return '';
    try {
      const photosDir = `${FileSystem.documentDirectory}meal_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photosDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
      }

      // ストレージ容量削減のため、最大幅600px, 圧縮率0.7で永続化保存
      const manip = await ImageManipulator.manipulateAsync(
        tempUri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const fileName = `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
      const permUri = `${photosDir}${fileName}`;

      await FileSystem.copyAsync({
        from: manip.uri || tempUri,
        to: permUri
      });

      return permUri;
    } catch (err) {
      console.warn('Failed to save photo permanently, using original temp URI:', err);
      return tempUri;
    }
  };

  // 画像のリサイズ・軽量化・Base64変換 (AI用超軽量処理)
  const processAndOptimizeImage = async (imageUri) => {
    setSelectedImageUri(imageUri);
    setAnalyzing(true);
    setProgressMsg('AI用に画像を軽量最適化中...');

    try {
      const previewManip = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (previewManip.uri) {
        setSelectedImageUri(previewManip.uri);
      }

      const aiManip = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 512 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      let base64Data = aiManip.base64;
      if (!base64Data) {
        base64Data = await convertUriToBase64(aiManip.uri || previewManip.uri || imageUri);
      } else {
        base64Data = `data:image/jpeg;base64,${base64Data}`;
      }

      if (base64Data) {
        setBase64Image(base64Data);
        await runAiAnalysis(base64Data);
      } else {
        setAnalyzing(false);
        Alert.alert('画像取得エラー', '写真データの処理に失敗しました。');
      }
    } catch (e) {
      console.error('Failed to optimize image for AI:', e);
      try {
        const fallbackB64 = await convertUriToBase64(imageUri);
        if (fallbackB64) {
          setBase64Image(fallbackB64);
          await runAiAnalysis(fallbackB64);
          return;
        }
      } catch (errFallback) {
        console.error('Fallback readAsStringAsync failed:', errFallback);
      }
      setAnalyzing(false);
      Alert.alert('画像処理エラー', '写真の処理中にエラーが発生しました。手動入力をご利用いただけます。');
    }
  };

  // カメラ撮影処理
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'カメラを使用するにはカメラへのアクセス許可が必要です。');
        return;
      }

      setSelectedImageUri(null);
      setBase64Image(null);
      setAiAnalysisResult(null);

      setIsPhotoModalOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8
      });

      setIsPhotoModalOpen(true);

      if (result && !result.canceled && result.assets && result.assets[0]) {
        await processAndOptimizeImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Camera Launch Error:', err);
      setIsPhotoModalOpen(true);
      setAnalyzing(false);
      Alert.alert('カメラエラー', 'カメラ起動または撮影処理中にエラーが発生しました。');
    }
  };

  // アルバムから写真選択
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', '写真を選択するにはライブラリへのアクセス許可が必要です。');
        return;
      }

      setSelectedImageUri(null);
      setBase64Image(null);
      setAiAnalysisResult(null);

      setIsPhotoModalOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8
      });

      setIsPhotoModalOpen(true);

      if (!result.canceled && result.assets && result.assets[0]) {
        await processAndOptimizeImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Pick Image Error:', err);
      setIsPhotoModalOpen(true);
      setAnalyzing(false);
      Alert.alert('ライブラリエラー', '写真選択中にエラーが発生しました。');
    }
  };

  // AI写真解析実行
  const runAiAnalysis = async (imgBase64) => {
    setAnalyzing(true);
    setProgressMsg(recordMode === 'ocr' ? 'OCR & 栄養表示ラベルを解析中...' : 'AIで料理写真から料理名・栄養価を判定中...');

    try {
      const res = await analyzeMealPhoto({
        base64Image: imgBase64,
        workerProxyUrl: SECURE_WORKER_PROXY_URL,
        preferredModel: preferredAiModel,
        onProgress: (msg) => setProgressMsg(msg)
      });

      setAiAnalysisResult(res);

      if (res && (res.mealName || res.calories)) {
        setMealNameInput(res.mealName || (recordMode === 'ocr' ? '栄養成分表示商品' : '検出料理'));
        setCaloriesInput(String(res.calories || 0));
        setProteinInput(String(res.protein || 0));
        setFatInput(String(res.fat || 0));
        setCarbsInput(String(res.carbs || 0));
        setSodiumInput(String(res.sodium || 0));
        setFiberInput(String(res.fiber || 0));
      } else {
        const defaultName = recordMode === 'ocr' ? '栄養成分表示食品' : '記録写真料理';
        setMealNameInput(defaultName);
        setCaloriesInput('550');
        setProteinInput('22.0');
        setFatInput('16.0');
        setCarbsInput('75.0');
        setSodiumInput('2.1');
        setFiberInput('3.0');
      }
    } catch (err) {
      console.warn('AI Analysis Warning:', err);
      const fallbackName = recordMode === 'ocr' ? '栄養成分表示食品' : '写真解析料理';
      setMealNameInput(fallbackName);
      setCaloriesInput('480');
      setProteinInput('18.5');
      setFatInput('14.0');
      setCarbsInput('65.0');
      setSodiumInput('1.8');
      setFiberInput('2.5');
    } finally {
      setAnalyzing(false);
    }
  };

  // 目標進捗計算
  const totals = mealLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + (Number(log.calories) || 0),
      protein: acc.protein + (Number(log.protein) || 0),
      fat: acc.fat + (Number(log.fat) || 0),
      carbs: acc.carbs + (Number(log.carbs) || 0),
      sodium: acc.sodium + (Number(log.sodium) || 0),
      fiber: acc.fiber + (Number(log.fiber) || 0)
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0, fiber: 0 }
  );

  const handleSaveMeal = async (mealData) => {
    await nutritionDb.addMealLog({
      ...mealData,
      date: selectedDate
    });
    await loadMealLogs();
  };

  const handleDeleteMeal = async (id) => {
    Alert.alert('ログ削除', 'この食事記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await nutritionDb.deleteMealLog(id);
          await loadMealLogs();
        }
      }
    ]);
  };

  const handleOpenEditModal = (log) => {
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

  const handleSaveEditMeal = async () => {
    if (!editingMealLog) return;
    if (!editMealName.trim()) {
      Alert.alert('入力エラー', '食品・料理名を入力してください。');
      return;
    }

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
    await loadMealLogs();
  };

  // MDパース実行
  const handleParseMdInput = () => {
    if (!mdInput.trim()) {
      setMdErrorMsg('Markdownテキストを入力してください');
      return;
    }
    const items = parseMealMarkdown(mdInput, selectedDate);
    if (items.length === 0) {
      setMdErrorMsg('食事データが検出されませんでした。形式（表形式またはリスト形式）を確認してください。');
      setMdParsedMeals(null);
      setMdSelectedIndices([]);
    } else {
      setMdErrorMsg('');
      setMdParsedMeals(items);
      setMdSelectedIndices(items.map((_, i) => i));
    }
  };

  // MDパース結果の一括保存
  const handleSaveParsedMdMeals = async () => {
    if (!mdParsedMeals || mdSelectedIndices.length === 0) return;
    try {
      setLoading(true);
      for (const idx of mdSelectedIndices) {
        const item = mdParsedMeals[idx];
        await nutritionDb.addMealLog({
          date: item.date || selectedDate,
          mealType: item.mealType || 'lunch',
          name: item.name || 'MD取り込み食事',
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          fat: Number(item.fat) || 0,
          carbs: Number(item.carbs) || 0,
          fiber: Number(item.fiber) || 0,
          sodium: Number(item.sodium) || 0,
          memo: item.memo || 'MD一括取り込み'
        });
      }
      await loadMealLogs();
      if (obsidianEnabled && obsidianAutoSyncOnLaunch) {
        await obsidianSyncService.syncAllMealLogs(userGoals);
      }
      setIsMdModalOpen(false);
      setMdInput('');
      setMdParsedMeals(null);
      setMdSelectedIndices([]);
      Alert.alert('登録完了', `${mdSelectedIndices.length}件の食事ログを一括保存しました！`);
    } catch (e) {
      Alert.alert('エラー', '一括保存に失敗しました: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

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
    Alert.alert('保存完了', '設定を保存しました。');
  };

  const handleCheckOTAUpdate = async () => {
    try {
      if (!Updates.isEnabled) {
        Alert.alert('OTA無効 (Debugモード)', '現在のビルドはDebugモードのためOTAが無効化されています。Releaseビルド(assembleRelease)でのみOTA機能が動作します。');
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      const currentId = Updates.updateId ? Updates.updateId.substring(0, 8) + '...' : '初期組み込み版(Embedded)';
      if (update.isAvailable) {
        Alert.alert(
          '新バージョン検出',
          `新しいOTAアップデートが見つかりました。(現在: ${currentId})\n今すぐ適用してアプリを再起動しますか？`,
          [
            { text: '後で', style: 'cancel' },
            {
              text: '更新して再起動',
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (e) {
                  Alert.alert('更新エラー', 'アップデートの取得に失敗しました。');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('最新状態', `アプリはすでに最新のOTAバージョンを適用済みです。\n(適用中ID: ${currentId})`);
      }
    } catch (error) {
      console.warn('OTA Check Error:', error);
      const currentId = Updates.updateId ? Updates.updateId.substring(0, 8) + '...' : '初期組み込み版';
      Alert.alert('OTA確認', `最新の更新が適用されているか、開発モードです。\n(適用中ID: ${currentId})\n${error?.message || ''}`);
    }
  };

  const handleSavePhotoMealRecord = async () => {
    if (!mealNameInput.trim()) {
      Alert.alert('入力エラー', '食品・料理名を入力してください。');
      return;
    }

    const mult = recordMode === 'ocr' ? portionPercentage / 100 : portionMultiplier;

    const finalCal = Math.round((Number(caloriesInput) || 0) * mult);
    const finalP = Number(((Number(proteinInput) || 0) * mult).toFixed(1));
    const finalF = Number(((Number(fatInput) || 0) * mult).toFixed(1));
    const finalC = Number(((Number(carbsInput) || 0) * mult).toFixed(1));
    const finalNa = Number(((Number(sodiumInput) || 0) * mult).toFixed(1));
    const finalFiber = Number(((Number(fiberInput) || 0) * mult).toFixed(1));

    let permanentPhotoPath = '';
    if (selectedImageUri) {
      permanentPhotoPath = await saveMealPhotoToPermanentStorage(selectedImageUri);
    }

    await handleSaveMeal({
      name: mealNameInput,
      mealType,
      calories: finalCal,
      protein: finalP,
      fat: finalF,
      carbs: finalC,
      sodium: finalNa,
      fiber: finalFiber,
      photoUrl: permanentPhotoPath || selectedImageUri || '',
      memo: recordMode === 'ocr' ? `【成分表示モード】摂取量: ${portionPercentage}%` : `【料理写真モード】量: ${portionMultiplier}倍`
    });

    setSelectedImageUri(null);
    setBase64Image(null);
    setAiAnalysisResult(null);
    setMealNameInput('');
    setCaloriesInput('');
    setProteinInput('');
    setFatInput('');
    setCarbsInput('');
    setSodiumInput('');
    setFiberInput('');
    setPortionMultiplier(1.0);
    setPortionPercentage(100);
    setIsPhotoModalOpen(false);
  };

  const handleAnalyzeChatMeal = async () => {
    if (!chatInput.trim() || chatAnalyzing) return;
    setChatAnalyzing(true);
    setChatAnalyzedData(null);
    setChatMessages([{ sender: 'user', text: chatInput.trim() }]);
    setChatFollowUpInput('');
    try {
      const parsedData = await analyzeMealTextWithAI({
        textInput: chatInput.trim(),
        workerProxyUrl: SECURE_WORKER_PROXY_URL,
        preferredModel: preferredAiModel
      });
      setChatAnalyzedData(parsedData);
      setChatMessages(prev => [...prev, { sender: 'ai', text: `「${parsedData.mealName}」として解析しました。` }]);
    } catch (err) {
      console.error('Chat analysis error:', err);
      Alert.alert('解析エラー', 'AI解析に失敗しました: ' + (err.message || ''));
    } finally {
      setChatAnalyzing(false);
    }
  };

  const handleFollowUpChat = async () => {
    if (!chatFollowUpInput.trim() || chatFollowUpAnalyzing) return;
    const followUp = chatFollowUpInput.trim();
    setChatFollowUpInput('');
    setChatFollowUpAnalyzing(true);
    setChatMessages(prev => [...prev, { sender: 'user', text: followUp }]);
    const combinedInput = `${chatInput}${followUp ? `。追加情報: ${followUp}` : ''}`;
    try {
      const parsedData = await analyzeMealTextWithAI({
        textInput: combinedInput,
        workerProxyUrl: SECURE_WORKER_PROXY_URL,
        preferredModel: preferredAiModel
      });
      setChatAnalyzedData(parsedData);
      setChatMessages(prev => [...prev, { sender: 'ai', text: `内容を更新しました。「${parsedData.mealName}」(${parsedData.calories}kcal)` }]);
    } catch (err) {
      console.error('Follow-up chat error:', err);
      setChatMessages(prev => [...prev, { sender: 'ai', text: '再解析に失敗しました。もう一度お試しください。' }]);
    } finally {
      setChatFollowUpAnalyzing(false);
    }
  };

  const handleConfirmChatMeal = async () => {
    if (!chatAnalyzedData || loading) return;
    setLoading(true);
    try {
      const mealName = chatAnalyzedData.mealName || chatInput.trim();
      const calories = Number(chatAnalyzedData.calories) || 0;
      const protein = Number(chatAnalyzedData.protein) || 0;
      const fat = Number(chatAnalyzedData.fat) || 0;
      const carbs = Number(chatAnalyzedData.carbs) || 0;
      const sodium = Number(chatAnalyzedData.sodium) || 0;
      const fiber = Number(chatAnalyzedData.fiber) || 0;
      await handleSaveMeal({
        name: mealName,
        mealType: chatMealType,
        calories,
        protein,
        fat,
        carbs,
        sodium,
        fiber,
        memo: chatAnalyzedData.advice ? `AI解析: ${chatAnalyzedData.advice}` : 'AIチャット解析ログ'
      });
      setChatInput('');
      setChatAnalyzedData(null);
      setChatMealType('lunch');
      setChatMessages([]);
      setChatFollowUpInput('');
      setIsChatModalOpen(false);
      Alert.alert('AI記録完了', `「${mealName}」(${calories}kcal) を保存しました`);
    } catch (err) {
      console.error('Chat save error:', err);
      Alert.alert('保存エラー', err.message || '');
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />

      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.appTitle}>EIYOU 栄養管理</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setIsSettingsModalOpen(true)}
          >
            <Text style={styles.settingsButtonText}>⚙️ 設定</Text>
          </TouchableOpacity>
        </View>

        {/* 日付切り替え */}
        <View style={styles.dateSelector}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateNavButton}>
            <Text style={styles.dateNavText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{selectedDate}</Text>
          <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavButton}>
            <Text style={styles.dateNavText}>▶</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* サマリーカード / 栄養目標サマリー */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 摂取栄養サマリー</Text>

          {/* カロリープログレス */}
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>摂取カロリー</Text>
            <Text style={styles.metricValue}>
              {totals.calories} / {userGoals.calories} kcal
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, (totals.calories / (userGoals.calories || 1)) * 100)}%`,
                  backgroundColor: totals.calories > userGoals.calories ? '#ef4444' : '#10b981'
                }
              ]}
            />
          </View>

          {/* PFC バランス */}
          <View style={styles.pfcGrid}>
            <View style={styles.pfcItem}>
              <Text style={styles.pfcLabel}>タンパク質(P)</Text>
              <Text style={styles.pfcVal}>{totals.protein.toFixed(1)} / {userGoals.protein}g</Text>
            </View>
            <View style={styles.pfcItem}>
              <Text style={styles.pfcLabel}>脂質(F)</Text>
              <Text style={styles.pfcVal}>{totals.fat.toFixed(1)} / {userGoals.fat}g</Text>
            </View>
            <View style={styles.pfcItem}>
              <Text style={styles.pfcLabel}>炭水化物(C)</Text>
              <Text style={styles.pfcVal}>{totals.carbs.toFixed(1)} / {userGoals.carbs}g</Text>
            </View>
            <View style={styles.pfcItem}>
              <Text style={styles.pfcLabel}>塩分相当量</Text>
              <Text style={styles.pfcVal}>{totals.sodium.toFixed(1)} / {userGoals.sodium}g</Text>
            </View>
            <View style={styles.pfcItem}>
              <Text style={styles.pfcLabel}>食物繊維</Text>
              <Text style={styles.pfcVal}>{totals.fiber.toFixed(1)} / {userGoals.fiber || 20}g</Text>
            </View>
          </View>
        </View>

        {/* 履歴栄養推移グラフカード */}
        <HistoryChartCard allLogs={allHistoryLogs} userGoals={userGoals} />

        {/* 食事記録リスト */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🍴 食事ログ一覧 ({selectedDate})</Text>

          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginVertical: 20 }} />
          ) : mealLogs.length === 0 ? (
            <Text style={styles.emptyText}>この日付の食事記録はまだありません。</Text>
          ) : (
            mealLogs.map((log) => (
              <View key={log.id} style={styles.mealCardContainer}>
                <View style={styles.mealCardTopRow}>
                  {log.photoUrl ? (
                    <TouchableOpacity onPress={() => setSelectedPreviewPhoto(log.photoUrl)}>
                      <Image
                        source={{ uri: log.photoUrl }}
                        style={styles.mealCardPhoto}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.mealCardInfo}>
                    <Text style={styles.mealName}>{log.name}</Text>
                    <Text style={styles.mealDetail}>
                      {log.calories} kcal | P:{log.protein}g F:{log.fat}g C:{log.carbs}g{log.fiber !== undefined && log.fiber !== null ? ` Fi:${log.fiber}g` : ''}
                    </Text>
                    {log.memo ? <Text style={styles.mealMemo}>{log.memo}</Text> : null}
                  </View>
                </View>

                <View style={styles.mealCardBottomRow}>
                  {(() => {
                    const isFav = favorites.some(f => (f.name || '').trim().toLowerCase() === (log.name || '').trim().toLowerCase());
                    return (
                      <TouchableOpacity
                        onPress={() => handleToggleFavorite(log)}
                        style={[
                          styles.actionChip,
                          {
                            backgroundColor: isFav ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                            borderColor: isFav ? '#f59e0b' : '#334155',
                            borderWidth: 1
                          }
                        ]}
                      >
                        <Text style={[styles.actionChipText, { color: isFav ? '#f59e0b' : '#94a3b8' }]}>
                          {isFav ? '★' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                  <TouchableOpacity
                    onPress={() => handleSaveMeal({
                      name: log.name,
                      mealType: log.mealType,
                      calories: log.calories,
                      protein: log.protein,
                      fat: log.fat,
                      carbs: log.carbs,
                      sodium: log.sodium,
                      fiber: log.fiber,
                      photoUrl: log.photoUrl,
                      memo: log.memo
                    })}
                    style={[styles.actionChip, { backgroundColor: '#10b981' }]}
                  >
                    <Text style={[styles.actionChipText, { color: '#ffffff' }]}>＋ 再追加</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleOpenEditModal(log)}
                    style={[styles.actionChip, { backgroundColor: '#3b82f6' }]}
                  >
                    <Text style={[styles.actionChipText, { color: '#ffffff' }]}>編集</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteMeal(log.id)}
                    style={[styles.actionChip, { backgroundColor: '#ef4444' }]}
                  >
                    <Text style={[styles.actionChipText, { color: '#ffffff' }]}>削除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ボトムアクションエリア */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#3b82f6', flex: 1 }]}
          onPress={() => setIsPhotoModalOpen(true)}
        >
          <Text style={styles.actionBtnText}>📷 写真記録</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#8b5cf6', flex: 1 }]}
          onPress={() => setIsChatModalOpen(true)}
        >
          <Text style={styles.actionBtnText}>💬 チャット</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#059669', flex: 1 }]}
          onPress={handleOpenHistoryModal}
        >
          <Text style={styles.actionBtnText}>📜 履歴追加</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#10b981', flex: 1 }]}
          onPress={() => {
            setMdInput('');
            setMdParsedMeals(null);
            setMdErrorMsg('');
            setIsMdModalOpen(true);
          }}
        >
          <Text style={styles.actionBtnText}>📋 MD一括</Text>
        </TouchableOpacity>
      </View>

      {/* 📜 履歴選択・追加モーダル */}
      <Modal visible={isHistoryModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>📜 履歴から食事を追加</Text>
              <TouchableOpacity onPress={() => setIsHistoryModalOpen(false)}>
                <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold', padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
              過去の全記録から選択して「{selectedDate}」に追加します
            </Text>

            <Text style={styles.inputLabel}>追加先の食事区分</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {[
                { type: 'breakfast', label: '朝食' },
                { type: 'lunch', label: '昼食' },
                { type: 'dinner', label: '夕食' },
                { type: 'snack', label: '間食' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  onPress={() => setHistoryTargetMealType(item.type)}
                  style={[
                    styles.portionBtn,
                    { flex: 1, paddingVertical: 8 },
                    historyTargetMealType === item.type && styles.activePortionBtn
                  ]}
                >
                  <Text style={[styles.portionBtnText, historyTargetMealType === item.type && styles.activePortionBtnText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.inputLabel}>追加の倍数 / 量</Text>
              <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold' }}>{historyMultiplier}倍</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              {[0.5, 1.0, 1.5, 2.0].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setHistoryMultiplier(m)}
                  style={[
                    styles.portionBtn,
                    { flex: 1, paddingVertical: 7 },
                    historyMultiplier === m && styles.activePortionBtn
                  ]}
                >
                  <Text style={[styles.portionBtnText, historyMultiplier === m && styles.activePortionBtnText]}>
                    {m}倍
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 4, height: 33, borderWidth: 1, borderColor: '#334155' }}>
                <TouchableOpacity
                  onPress={() => setHistoryMultiplier((prev) => Math.max(0.1, Math.round((prev - 0.1) * 10) / 10))}
                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 16 }}>-</Text>
                </TouchableOpacity>
                <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12, minWidth: 30, textAlign: 'center' }}>
                  {historyMultiplier}x
                </Text>
                <TouchableOpacity
                  onPress={() => setHistoryMultiplier((prev) => Math.round((prev + 0.1) * 10) / 10)}
                  style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                >
                  <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 16 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              placeholder="料理名で検索..."
              placeholderTextColor="#94a3b8"
              value={historySearchQuery}
              onChangeText={setHistorySearchQuery}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, height: 40 }} contentContainerStyle={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {[
                  { id: 'favorites', label: `⭐ お気に入り (${favorites.length})` },
                  { id: 'recent', label: '履歴順' },
                  { id: 'frequent', label: 'よく食べる' },
                  { id: 'breakfast', label: '朝食' },
                  { id: 'lunch', label: '昼食' },
                  { id: 'dinner', label: '夕食' },
                  { id: 'snack', label: '間食' }
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setHistoryTab(tab.id)}
                    style={[
                      styles.portionBtn,
                      { paddingHorizontal: 12, paddingVertical: 6, height: 34, justifyContent: 'center', alignItems: 'center' },
                      historyTab === tab.id && styles.activePortionBtn
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.portionBtnText, historyTab === tab.id && styles.activePortionBtnText]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <ScrollView style={{ flex: 1, maxHeight: 380 }}>
              {(() => {
                let filtered = [];
                if (historyTab === 'favorites') {
                  filtered = favorites;
                } else if (historyTab === 'frequent') {
                  const map = new Map();
                  [...favorites, ...allHistoryLogs].forEach((item) => {
                    const key = (item.name || '').trim().toLowerCase();
                    if (!key) return;
                    if (!map.has(key)) {
                      map.set(key, { count: 1, sample: item });
                    } else {
                      map.get(key).count += 1;
                    }
                  });
                  filtered = Array.from(map.values())
                    .sort((a, b) => b.count - a.count)
                    .map((e) => ({ ...e.sample, frequentCount: e.count }));
                } else if (['breakfast', 'lunch', 'dinner', 'snack'].includes(historyTab)) {
                  const map = new Map();
                  favorites.forEach((fav) => {
                    const key = (fav.name || '').trim().toLowerCase();
                    if (!key) return;
                    if (!fav.mealType || fav.mealType === historyTab) {
                      map.set(key, fav);
                    }
                  });
                  allHistoryLogs.forEach((log) => {
                    const key = (log.name || '').trim().toLowerCase();
                    if (!key) return;
                    if (log.mealType === historyTab && !map.has(key)) {
                      map.set(key, log);
                    }
                  });
                  filtered = Array.from(map.values());
                } else {
                  const map = new Map();
                  favorites.forEach((fav) => {
                    const key = (fav.name || '').trim().toLowerCase();
                    if (key) map.set(key, fav);
                  });
                  allHistoryLogs.forEach((log) => {
                    const key = (log.name || '').trim().toLowerCase();
                    if (key && !map.has(key)) map.set(key, log);
                  });
                  filtered = Array.from(map.values());
                }

                if (historySearchQuery.trim()) {
                  const q = historySearchQuery.toLowerCase();
                  filtered = filtered.filter(
                    (item) => (item.name && item.name.toLowerCase().includes(q)) || (item.memo && item.memo.toLowerCase().includes(q))
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 30, fontSize: 13 }}>
                      {historyTab === 'favorites' ? 'お気に入りに登録された食事項目がありません。リストの「★」で登録できます。' : '該当する食事履歴がありません'}
                    </Text>
                  );
                }

                return filtered.map((item, index) => {
                  const isFav = favorites.some(f => (f.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase());
                  const calcVal = (val, mult) => Math.round((Number(val) || 0) * mult * 10) / 10;
                  const cal = Math.round((Number(item.calories) || 0) * historyMultiplier);
                  const p = calcVal(item.protein, historyMultiplier);
                  const f = calcVal(item.fat, historyMultiplier);
                  const c = calcVal(item.carbs, historyMultiplier);
                  const sodium = calcVal(item.sodium, historyMultiplier);
                  const fiber = calcVal(item.fiber, historyMultiplier);

                  return (
                    <View
                      key={item.id ? `${item.id}-${index}` : index}
                      style={{
                        backgroundColor: '#1e293b',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      {item.photoUrl ? (
                        <TouchableOpacity onPress={() => setSelectedPreviewPhoto(item.photoUrl)}>
                          <Image
                            source={{ uri: item.photoUrl }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              marginRight: 10,
                              borderWidth: 1,
                              borderColor: '#334155'
                            }}
                          />
                        </TouchableOpacity>
                      ) : null}
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 14, marginBottom: 2 }}>
                          {item.name} {item.frequentCount ? `(${item.frequentCount}回)` : ''}
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                          {historyMultiplier === 1 ? (
                            `${item.calories} kcal | P:${item.protein}g F:${item.fat}g C:${item.carbs}g`
                          ) : (
                            <Text>
                              <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{cal} kcal ({historyMultiplier}倍)</Text>
                              <Text style={{ color: '#64748b' }}> [元:{item.calories}k]</Text>
                              <Text>{` | P:${p}g F:${f}g C:${c}g`}</Text>
                            </Text>
                          )}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => handleToggleFavorite(item)}
                          style={{
                            backgroundColor: isFav ? 'rgba(245, 158, 11, 0.2)' : '#334155',
                            borderColor: isFav ? '#f59e0b' : 'transparent',
                            borderWidth: isFav ? 1 : 0,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            borderRadius: 8
                          }}
                        >
                          <Text style={{ color: isFav ? '#f59e0b' : '#94a3b8', fontWeight: 'bold', fontSize: 12 }}>
                            {isFav ? '★' : '☆'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={async () => {
                            await handleSaveMeal({
                              name: item.name,
                              mealType: historyTargetMealType,
                              calories: cal,
                              protein: p,
                              fat: f,
                              carbs: c,
                              sodium: sodium,
                              fiber: fiber,
                              photoUrl: item.photoUrl || '',
                              memo: historyMultiplier !== 1
                                ? `(履歴追加 ${historyMultiplier}倍) ${item.memo || ''}`.trim()
                                : (item.memo ? `(履歴追加) ${item.memo}` : '履歴追加')
                            });
                            Alert.alert('追加完了', `「${item.name}」(${historyMultiplier}倍)を${selectedDate}に追加しました`);
                          }}
                          style={{
                            backgroundColor: '#10b981',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>+ 追加</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                });
              })()}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#475569', marginTop: 12 }]}
              onPress={() => setIsHistoryModalOpen(false)}
            >
              <Text style={styles.saveBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 📷 写真・カメラ記録モーダル */}
      <Modal visible={isPhotoModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📷 食事・栄養表示の記録</Text>

              <View style={styles.modeTabContainer}>
                <TouchableOpacity
                  style={[styles.modeTab, recordMode === 'ocr' && styles.activeModeTab]}
                  onPress={() => setRecordMode('ocr')}
                >
                  <Text style={[styles.modeTabText, recordMode === 'ocr' && styles.activeModeTabText]}>
                    📄 成分表示ラベル
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, recordMode === 'dish' && styles.activeModeTab]}
                  onPress={() => setRecordMode('dish')}
                >
                  <Text style={[styles.modeTabText, recordMode === 'dish' && styles.activeModeTabText]}>
                    🍱 料理写真
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, recordMode === 'manual' && styles.activeModeTab]}
                  onPress={() => setRecordMode('manual')}
                >
                  <Text style={[styles.modeTabText, recordMode === 'manual' && styles.activeModeTabText]}>
                    ✍️ 手動入力
                  </Text>
                </TouchableOpacity>
              </View>

              {recordMode !== 'manual' && (
                <View style={styles.cameraBtnRow}>
                  <TouchableOpacity
                    style={[styles.cameraActionBtn, { backgroundColor: '#0284c7' }]}
                    onPress={handleTakePhoto}
                  >
                    <Text style={styles.cameraActionBtnText}>📸 カメラで撮影</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cameraActionBtn, { backgroundColor: '#475569' }]}
                    onPress={handlePickImage}
                  >
                    <Text style={styles.cameraActionBtnText}>🖼️ ライブラリから選択</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedImageUri && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
                  {analyzing && (
                    <View style={styles.analyzingOverlay}>
                      <ActivityIndicator size="large" color="#38bdf8" />
                      <Text style={styles.analyzingText}>{progressMsg}</Text>
                    </View>
                  )}
                </View>
              )}

              {recordMode === 'ocr' && (
                <View style={styles.portionBox}>
                  <Text style={styles.portionTitle}>⚖️ 食べた割合の調整 (基準値に対して)</Text>
                  <View style={styles.portionBtnRow}>
                    {[25, 50, 75, 100, 150, 200].map((pct) => (
                      <TouchableOpacity
                        key={pct}
                        style={[styles.portionBtn, portionPercentage === pct && styles.activePortionBtn]}
                        onPress={() => setPortionPercentage(pct)}
                      >
                        <Text style={[styles.portionBtnText, portionPercentage === pct && styles.activePortionBtnText]}>
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {recordMode === 'dish' && (
                <View style={styles.portionBox}>
                  <Text style={styles.portionTitle}>🍽️ 食べた量の倍率調整</Text>
                  <View style={styles.portionBtnRow}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((mult) => (
                      <TouchableOpacity
                        key={mult}
                        style={[styles.portionBtn, portionMultiplier === mult && styles.activePortionBtn]}
                        onPress={() => setPortionMultiplier(mult)}
                      >
                        <Text style={[styles.portionBtnText, portionMultiplier === mult && styles.activePortionBtnText]}>
                          {mult}倍
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.inputLabel}>食品・料理名</Text>
              <TextInput
                style={styles.input}
                placeholder="例: 鮭おにぎり / サラダ"
                placeholderTextColor="#94a3b8"
                value={mealNameInput}
                onChangeText={setMealNameInput}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.inputLabel}>カロリー (kcal)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={caloriesInput}
                    onChangeText={setCaloriesInput}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.inputLabel}>タンパク質 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={proteinInput}
                    onChangeText={setProteinInput}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.inputLabel}>脂質 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={fatInput}
                    onChangeText={setFatInput}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.inputLabel}>炭水化物 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={carbsInput}
                    onChangeText={setCarbsInput}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.inputLabel}>塩分相当量 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={sodiumInput}
                    onChangeText={setSodiumInput}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.inputLabel}>食物繊維 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={fiberInput}
                    onChangeText={setFiberInput}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>食事の区分</Text>
              <View style={styles.mealTypeRow}>
                {[
                  { type: 'breakfast', label: '朝食' },
                  { type: 'lunch', label: '昼食' },
                  { type: 'dinner', label: '夕食' },
                  { type: 'snack', label: '間食' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.mealTypeBtn, mealType === item.type && styles.activeMealTypeBtn]}
                    onPress={() => setMealType(item.type)}
                  >
                    <Text style={[styles.mealTypeBtnText, mealType === item.type && styles.activeMealTypeBtnText]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                  onPress={() => setIsPhotoModalOpen(false)}
                >
                  <Text style={styles.modalBtnText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#10b981' }]}
                  onPress={handleSavePhotoMealRecord}
                >
                  <Text style={styles.modalBtnText}>保存する</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* チャット記録モーダル */}
      <Modal
        visible={isChatModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!chatAnalyzing && !loading) {
            setChatInput('');
            setChatAnalyzedData(null);
            setChatMealType('lunch');
            setChatMessages([]);
            setChatFollowUpInput('');
            setIsChatModalOpen(false);
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-start', paddingTop: 45, paddingHorizontal: 12, paddingBottom: 20 }}>
          <View style={{
            backgroundColor: '#1e293b',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#334155',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            maxHeight: '92%',
            flex: 1,
          }}>
            <Text style={styles.modalTitle}>💬 チャット栄養AI記録</Text>

            {!chatAnalyzedData && (
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSub}>食べたものを自由に入力してください</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder="例: 朝食にバナナ1本と牛乳200ml、ゆで卵1個"
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={chatInput}
                  onChangeText={setChatInput}
                  editable={!chatAnalyzing}
                />
                {chatAnalyzing && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <ActivityIndicator size="small" color="#8b5cf6" />
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>AIが栄養価を解析中...</Text>
                  </View>
                )}
                <View style={[styles.modalButtons, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                    onPress={() => {
                      setChatInput('');
                      setChatAnalyzedData(null);
                      setChatMealType('lunch');
                      setChatMessages([]);
                      setChatFollowUpInput('');
                      setIsChatModalOpen(false);
                    }}
                    disabled={chatAnalyzing}
                  >
                    <Text style={styles.modalBtnText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: chatAnalyzing || !chatInput.trim() ? '#4a3f6b' : '#8b5cf6' }]}
                    onPress={handleAnalyzeChatMeal}
                    disabled={chatAnalyzing || !chatInput.trim()}
                  >
                    <Text style={styles.modalBtnText}>{chatAnalyzing ? '解析中...' : '🤖 AIで解析'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {chatAnalyzedData && (
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <ScrollView style={{ flex: 1, marginBottom: 12 }} contentContainerStyle={{ gap: 10 }}>
                  <Text style={{ color: '#8b5cf6', fontSize: 13, fontWeight: 'bold', marginBottom: 4 }}>
                    🤖 解析結果（対話で調整できます）
                  </Text>

                  {chatMessages.map((msg, idx) => (
                    <View
                      key={idx}
                      style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        backgroundColor: msg.sender === 'user' ? '#8b5cf6' : '#0f172a',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        maxWidth: '85%',
                        borderWidth: msg.sender === 'ai' ? 1 : 0,
                        borderColor: '#334155'
                      }}
                    >
                      <Text style={{ color: '#f8fafc', fontSize: 13, lineHeight: 18 }}>{msg.text}</Text>
                    </View>
                  ))}

                  <View style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#8b5cf6', marginTop: 4 }}>
                    <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
                      {chatAnalyzedData.mealName || '解析した食事'}
                    </Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold' }}>
                        カロリー: {chatAnalyzedData.calories || 0} kcal
                      </Text>
                      <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                        P: {chatAnalyzedData.protein || 0}g
                      </Text>
                      <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                        F: {chatAnalyzedData.fat || 0}g
                      </Text>
                      <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                        C: {chatAnalyzedData.carbs || 0}g
                      </Text>
                      {chatAnalyzedData.sodium !== undefined && (
                        <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                          塩分: {chatAnalyzedData.sodium || 0}g
                        </Text>
                      )}
                      {chatAnalyzedData.fiber !== undefined && (
                        <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                          繊維: {chatAnalyzedData.fiber || 0}g
                        </Text>
                      )}
                    </View>

                    {chatAnalyzedData.advice && (
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                        💡 {chatAnalyzedData.advice}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.inputLabel}>食事区分を選択</Text>
                  <View style={styles.mealTypeRow}>
                    {[
                      { type: 'breakfast', label: '朝食' },
                      { type: 'lunch', label: '昼食' },
                      { type: 'dinner', label: '夕食' },
                      { type: 'snack', label: '間食' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.type}
                        style={[styles.mealTypeBtn, chatMealType === item.type && styles.activeMealTypeBtn]}
                        onPress={() => setChatMealType(item.type)}
                      >
                        <Text style={[styles.mealTypeBtnText, chatMealType === item.type && styles.activeMealTypeBtnText]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 40, marginVertical: 0, fontSize: 12 }]}
                    placeholder="修正をAIに伝える (例: ご飯大盛りだった, ドレッシング無し)"
                    placeholderTextColor="#64748b"
                    value={chatFollowUpInput}
                    onChangeText={setChatFollowUpInput}
                    editable={!chatFollowUpAnalyzing}
                  />
                  <TouchableOpacity
                    style={{
                      backgroundColor: chatFollowUpAnalyzing || !chatFollowUpInput.trim() ? '#334155' : '#8b5cf6',
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    onPress={handleFollowUpChat}
                    disabled={chatFollowUpAnalyzing || !chatFollowUpInput.trim()}
                  >
                    {chatFollowUpAnalyzing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>送信</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                    onPress={() => {
                      setChatInput('');
                      setChatAnalyzedData(null);
                      setChatMealType('lunch');
                      setChatMessages([]);
                      setChatFollowUpInput('');
                      setIsChatModalOpen(false);
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.modalBtnText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: loading ? '#047857' : '#10b981' }]}
                    onPress={handleConfirmChatMeal}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalBtnText}>✅ 食事記録を保存</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ⚙️ 設定 ＆ 目標 ＆ Obsidian連携 モーダル */}
      <Modal
        visible={isSettingsModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsSettingsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>⚙️ アプリ設定 & 目標設定</Text>
                <TouchableOpacity onPress={() => setIsSettingsModalOpen(false)}>
                  <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold', padding: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* 設定カテゴリ切り替えタブ */}
              <View style={styles.modeTabContainer}>
                <TouchableOpacity
                  style={[styles.modeTab, settingsTab === 'goals' && styles.activeModeTab]}
                  onPress={() => setSettingsTab('goals')}
                >
                  <Text style={[styles.modeTabText, settingsTab === 'goals' && styles.activeModeTabText]}>
                    🎯 栄養目標
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, settingsTab === 'obsidian' && styles.activeModeTab]}
                  onPress={() => setSettingsTab('obsidian')}
                >
                  <Text style={[styles.modeTabText, settingsTab === 'obsidian' && styles.activeModeTabText]}>
                    📓 Obsidian
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, settingsTab === 'data' && styles.activeModeTab]}
                  onPress={() => setSettingsTab('data')}
                >
                  <Text style={[styles.modeTabText, settingsTab === 'data' && styles.activeModeTabText]}>
                    ⚙️ アプリ・AI
                  </Text>
                </TouchableOpacity>
              </View>

              {/* タブ1: 🎯 栄養目標設定 (計算モード切り替え) */}
              {settingsTab === 'goals' && (
                <View>
                  <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                    📐 PFC目標値の算出モードを選択
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
                    {[
                      { mode: 'calorie_pfc', label: '1. カロリー ＆ PFC%' },
                      { mode: 'pfc_gram', label: '2. PFC(g) 直接入力' },
                      { mode: 'protein_pfc', label: '3. タンパク質 ＆ 比率' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.mode}
                        onPress={() => setGoalMode(item.mode)}
                        style={[
                          styles.portionBtn,
                          { flex: 1, paddingVertical: 6, paddingHorizontal: 2 },
                          goalMode === item.mode && styles.activePortionBtn
                        ]}
                      >
                        <Text style={[styles.portionBtnText, { fontSize: 10 }, goalMode === item.mode && styles.activePortionBtnText]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* モード1: カロリー ＆ PFC% */}
                  {goalMode === 'calorie_pfc' && (
                    <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' }}>
                      <Text style={styles.inputLabel}>目標総カロリー (kcal)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(userGoals.calories)}
                        onChangeText={(v) => handleCalorieAndRatioChangeNative(v, undefined, undefined, undefined)}
                      />
                      <Text style={[styles.inputLabel, { marginTop: 6 }]}>PFC比率 (%) [合計100%]</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>P(%)</Text>
                          <TextInput
                            style={[styles.input, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(pRatio)}
                            onChangeText={(v) => handleCalorieAndRatioChangeNative(undefined, v, undefined, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>F(%)</Text>
                          <TextInput
                            style={[styles.input, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(fRatio)}
                            onChangeText={(v) => handleCalorieAndRatioChangeNative(undefined, undefined, v, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>C(%)</Text>
                          <TextInput
                            style={[styles.input, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(cRatio)}
                            onChangeText={(v) => handleCalorieAndRatioChangeNative(undefined, undefined, undefined, v)}
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* モード2: PFC(g) 直接入力 */}
                  {goalMode === 'pfc_gram' && (
                    <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' }}>
                      <Text style={{ color: '#38bdf8', fontSize: 11, marginBottom: 6 }}>各PFCのグラム数を直接指定（総カロリーは自動計算）</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>P (g)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(userGoals.protein)}
                            onChangeText={(v) => handleGramChangeNative(v, undefined, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>F (g)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(userGoals.fat)}
                            onChangeText={(v) => handleGramChangeNative(undefined, v, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>C (g)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(userGoals.carbs)}
                            onChangeText={(v) => handleGramChangeNative(undefined, undefined, v)}
                          />
                        </View>
                      </View>
                      <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold', marginTop: 6, textAlign: 'right' }}>
                        算出総カロリー: {userGoals.calories} kcal
                      </Text>
                    </View>
                  )}

                  {/* モード3: タンパク質(g) ＆ 比率 */}
                  {goalMode === 'protein_pfc' && (
                    <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' }}>
                      <Text style={styles.inputLabel}>体重・必要量に応じたタンパク質 (g)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(userGoals.protein)}
                        onChangeText={(v) => handleProteinAndRatioChangeNative(v, undefined, undefined, undefined)}
                      />
                      <Text style={[styles.inputLabel, { marginTop: 6 }]}>PFC比率 (%) [P%をもとに総カロリー算出]</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>P(%)</Text>
                          <TextInput
                            style={[styles.input, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(pRatio)}
                            onChangeText={(v) => handleProteinAndRatioChangeNative(undefined, v, undefined, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>F(%)</Text>
                          <TextInput
                            style={[styles.input, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(fRatio)}
                            onChangeText={(v) => handleProteinAndRatioChangeNative(undefined, undefined, v, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 10 }}>C(%)</Text>
                          <TextInput
                            style={[styles.input, { textAlign: 'center' }]}
                            keyboardType="numeric"
                            value={String(cRatio)}
                            onChangeText={(v) => handleProteinAndRatioChangeNative(undefined, undefined, undefined, v)}
                          />
                        </View>
                      </View>
                      <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold', marginTop: 6, textAlign: 'right' }}>
                        逆算総カロリー: {userGoals.calories} kcal
                      </Text>
                    </View>
                  )}

                  {/* 現在の確定目標値確認 */}
                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#10b981', marginBottom: 12 }}>
                    <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
                      ✅ 適用中の目標値サマリー
                    </Text>
                    <Text style={{ color: '#f8fafc', fontSize: 12 }}>
                      {userGoals.calories} kcal | P:{userGoals.protein}g F:{userGoals.fat}g C:{userGoals.carbs}g | 比率: P{pRatio}% F{fRatio}% C{cRatio}%
                    </Text>
                  </View>

                  {/* 塩分 ＆ 食物繊維 */}
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>目標塩分上限 (g)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(userGoals.sodium)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, sodium: Number(val) || 0 })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>目標食物繊維 (g)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(userGoals.fiber || 20.0)}
                        onChangeText={(val) => setUserGoals({ ...userGoals, fiber: Number(val) || 0 })}
                      />
                    </View>
                  </View>

                  {/* 各栄養素の目標許容範囲 (-% 〜 +%) 設定 */}
                  <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginTop: 6, marginBottom: 6 }}>
                    🎯 目標許容範囲の調整 (%判定)
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
                    目標値に対する達成OK判定の許容幅 (-% 〜 +%) を個別に指定します。
                  </Text>

                  {[
                    { key: 'calories', label: 'カロリー (kcal)' },
                    { key: 'protein', label: 'タンパク質 (g)' },
                    { key: 'fat', label: '脂質 (g)' },
                    { key: 'carbs', label: '炭水化物 (g)' },
                    { key: 'sodium', label: '塩分 (g)' },
                    { key: 'fiber', label: '食物繊維 (g)' }
                  ].map(({ key, label }) => {
                    const tol = userGoals.tolerances?.[key] || DEFAULT_TOLERANCES[key];
                    return (
                      <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, backgroundColor: '#0f172a', padding: 8, borderRadius: 6 }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12, flex: 1.2 }}>{label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 2 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 11 }}>下限:</Text>
                          <TextInput
                            style={[styles.input, { flex: 1, paddingVertical: 2, paddingHorizontal: 4, height: 28, fontSize: 11, textAlign: 'center', marginVertical: 0 }]}
                            keyboardType="numeric"
                            value={String(tol.min)}
                            onChangeText={(v) => handleToleranceChange(key, 'min', v)}
                          />
                          <Text style={{ color: '#94a3b8', fontSize: 11 }}>% 〜 上限: +</Text>
                          <TextInput
                            style={[styles.input, { flex: 1, paddingVertical: 2, paddingHorizontal: 4, height: 28, fontSize: 11, textAlign: 'center', marginVertical: 0 }]}
                            keyboardType="numeric"
                            value={String(tol.max)}
                            onChangeText={(v) => handleToleranceChange(key, 'max', v)}
                          />
                          <Text style={{ color: '#94a3b8', fontSize: 11 }}>%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* タブ2: 📓 Obsidian 連携設定 (ローカルVault直接保存) */}
              {settingsTab === 'obsidian' && (
                <View>
                  <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                    📓 Obsidian Vault 連携 (ローカル同期)
                  </Text>

                  {/* 有効/無効トグル */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, backgroundColor: '#0f172a', padding: 10, borderRadius: 8 }}>
                    <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 13 }}>Obsidian 連携を有効化</Text>
                    <TouchableOpacity
                      onPress={() => setObsidianEnabled(!obsidianEnabled)}
                      style={{
                        backgroundColor: obsidianEnabled ? '#10b981' : '#475569',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                        {obsidianEnabled ? '有効 ON' : '無効 OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* フォルダ選択 (Storage Access Framework) */}
                  <Text style={styles.inputLabel}>Obsidian Vault フォルダ</Text>
                  <TouchableOpacity
                    onPress={handleSelectVaultFolder}
                    style={{ backgroundColor: '#0f172a', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 8 }}
                  >
                    <Text style={{ color: obsidianVaultUri ? '#38bdf8' : '#94a3b8', fontSize: 11 }} numberOfLines={1}>
                      {obsidianVaultUri || '📁 タップして Vault フォルダを選択...'}
                    </Text>
                  </TouchableOpacity>

                  {/* 出力保存モード選択 */}
                  <Text style={styles.inputLabel}>保存モード</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                    {[
                      { mode: 'dedicated', label: '1. 専用ノート (日別)' },
                      { mode: 'append', label: '2. デイリーノート追記' },
                      { mode: 'individual', label: '3. 単一統合ノート' }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.mode}
                        onPress={() => setObsidianSaveMode(item.mode)}
                        style={[
                          styles.portionBtn,
                          { flex: 1, paddingVertical: 6, paddingHorizontal: 2 },
                          obsidianSaveMode === item.mode && styles.activePortionBtn
                        ]}
                      >
                        <Text style={[styles.portionBtnText, { fontSize: 10 }, obsidianSaveMode === item.mode && styles.activePortionBtnText]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* サブフォルダ名 */}
                  <Text style={styles.inputLabel}>保存サブフォルダ名</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="EIYOU"
                    placeholderTextColor="#94a3b8"
                    value={obsidianFolderName}
                    onChangeText={setObsidianFolderName}
                  />

                  {/* 起動時自動同期 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 }}>
                    <Text style={{ color: '#cbd5e1', fontSize: 12 }}>起動時に全データを自動一括同期</Text>
                    <TouchableOpacity
                      onPress={() => setObsidianAutoSyncOnLaunch(!obsidianAutoSyncOnLaunch)}
                      style={{
                        backgroundColor: obsidianAutoSyncOnLaunch ? '#10b981' : '#475569',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                        {obsidianAutoSyncOnLaunch ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 手動同期ボタン */}
                  <TouchableOpacity
                    onPress={handleManualSyncAll}
                    style={{ backgroundColor: '#0284c7', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 4, marginBottom: 6 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🔄 今すぐObsidianへ一括同期・出力</Text>
                  </TouchableOpacity>

                  {!!syncStatusMsg && (
                    <Text style={{ color: '#38bdf8', fontSize: 11, textAlign: 'center', marginTop: 2 }}>{syncStatusMsg}</Text>
                  )}
                </View>
              )}

              {/* タブ3: ⚙️ アプリ設定 & AIモデル & 画面情報 */}
              {settingsTab === 'data' && (
                <View>
                  <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                    🤖 優先AI解析モデルの選択
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => setPreferredAiModel('gemini')}
                      style={[
                        styles.portionBtn,
                        { flex: 1, paddingVertical: 8 },
                        preferredAiModel === 'gemini' && styles.activePortionBtn
                      ]}
                    >
                      <Text style={[styles.portionBtnText, preferredAiModel === 'gemini' && styles.activePortionBtnText]}>
                        ✨ Gemini 3.6 Flash
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPreferredAiModel('deepseek')}
                      style={[
                        styles.portionBtn,
                        { flex: 1, paddingVertical: 8 },
                        preferredAiModel === 'deepseek' && styles.activePortionBtn
                      ]}
                    >
                      <Text style={[styles.portionBtnText, preferredAiModel === 'deepseek' && styles.activePortionBtnText]}>
                        🧠 DeepSeek V4 Flash
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* OTAアップデート確認ボタン */}
                  <TouchableOpacity
                    onPress={handleCheckOTAUpdate}
                    style={{ backgroundColor: '#8b5cf6', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>📲 OTAアップデートを確認</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.modalButtons, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                  onPress={() => setIsSettingsModalOpen(false)}
                >
                  <Text style={styles.modalBtnText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#3b82f6' }]}
                  onPress={handleSaveSettings}
                >
                  <Text style={styles.modalBtnText}>設定を保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ✏️ 食事記録編集モーダル */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>✏️ 食事記録の編集</Text>

              <Text style={styles.inputLabel}>食品・料理名</Text>
              <TextInput
                style={styles.input}
                value={editMealName}
                onChangeText={setEditMealName}
              />

              <Text style={styles.inputLabel}>食事の区分</Text>
              <View style={styles.mealTypeRow}>
                {[
                  { type: 'breakfast', label: '朝食' },
                  { type: 'lunch', label: '昼食' },
                  { type: 'dinner', label: '夕食' },
                  { type: 'snack', label: '間食' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.mealTypeBtn, editMealType === item.type && styles.activeMealTypeBtn]}
                    onPress={() => setEditMealType(item.type)}
                  >
                    <Text style={[styles.mealTypeBtnText, editMealType === item.type && styles.activeMealTypeBtnText]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.inputLabel}>カロリー (kcal)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editCalories}
                    onChangeText={setEditCalories}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.inputLabel}>タンパク質 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editProtein}
                    onChangeText={setEditProtein}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.inputLabel}>脂質 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editFat}
                    onChangeText={setEditFat}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.inputLabel}>炭水化物 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editCarbs}
                    onChangeText={setEditCarbs}
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.inputLabel}>塩分相当量 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editSodium}
                    onChangeText={setEditSodium}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.inputLabel}>食物繊維 (g)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editFiber}
                    onChangeText={setEditFiber}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>メモ</Text>
              <TextInput
                style={styles.input}
                placeholder="メモ"
                placeholderTextColor="#94a3b8"
                value={editMemo}
                onChangeText={setEditMemo}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <Text style={styles.modalBtnText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#3b82f6' }]}
                  onPress={handleSaveEditMeal}
                >
                  <Text style={styles.modalBtnText}>変更を保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* 📋 MD形式一括取り込みモーダル */}
      <Modal
        visible={isMdModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsMdModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', flex: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>📋 MDテキスト一括取り込み</Text>
              <TouchableOpacity onPress={() => setIsMdModalOpen(false)}>
                <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold', padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => setShowMdGuide(!showMdGuide)}
                style={{
                  backgroundColor: '#0f172a',
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#334155',
                  marginBottom: 12,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 13 }}>
                  💡 MDの記載方法ガイドを見る ({showMdGuide ? '閉じる' : '開く'})
                </Text>
              </TouchableOpacity>

              {showMdGuide && (
                <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' }}>
                  <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>
                    ① 表（テーブル）形式 【Obsidian/表計算向け】
                  </Text>
                  <Text style={{ color: '#a7f3d0', fontSize: 10, fontFamily: 'monospace', marginBottom: 8, lineHeight: 14 }}>
                    {`| 日付 | 分類 | メニュー名 | カロリー | P | F | C | 食物繊維 | 塩分 | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ${selectedDate} | [[朝食]] | プロテインとバナナ | 280 | 25.0 | 2.5 | 40.0 | 3.0 | 0.2 | 朝食後 |
| ${selectedDate} | [[昼食]] | サケ塩焼き定食 | 550 | 28.5 | 18.0 | 65.0 | 3.5 | 2.1 | 定食 |`}
                  </Text>

                  <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>
                    ② リスト・キー/値 形式 【箇条書き】
                  </Text>
                  <Text style={{ color: '#a7f3d0', fontSize: 10, fontFamily: 'monospace', marginBottom: 8, lineHeight: 14 }}>
                    {`# ${selectedDate} 昼食
- 食事名: サケ塩焼き定食
- カロリー: 550 kcal
- たんぱく質: 28.5 g
- 脂質: 18.0 g
- 炭水化物: 65.0 g
- 食物繊維: 3.5 g
- 塩分: 2.1 g
- メモ: ご飯大盛り`}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setMdInput(`| 日付 | 分類 | メニュー名 | カロリー | P | F | C | 食物繊維 | 塩分 | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ${selectedDate} | [[朝食]] | プロテインとバナナ | 280 | 25.0 | 2.5 | 40.0 | 3.0 | 0.2 | 朝食後 |
| ${selectedDate} | [[昼食]] | サケ塩焼き定食 | 550 | 28.5 | 18.0 | 65.0 | 3.5 | 2.1 | 定食 |`);
                      setMdErrorMsg('');
                    }}
                    style={{ backgroundColor: '#1e293b', padding: 6, borderRadius: 6, alignItems: 'center', marginTop: 4 }}
                  >
                    <Text style={{ color: '#10b981', fontSize: 11 }}>入力欄にサンプル表を挿入</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!mdParsedMeals ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>ここにMarkdownテキストを貼り付けてください:</Text>
                  <TextInput
                    style={[styles.input, { height: 140, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 }]}
                    placeholder="ここにMDテキストをペースト..."
                    placeholderTextColor="#64748b"
                    multiline
                    value={mdInput}
                    onChangeText={setMdInput}
                  />

                  {!!mdErrorMsg && (
                    <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>⚠️ {mdErrorMsg}</Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: '#64748b', flex: 1 }]}
                      onPress={() => setIsMdModalOpen(false)}
                    >
                      <Text style={styles.modalBtnText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: '#10b981', flex: 2 }]}
                      onPress={handleParseMdInput}
                    >
                      <Text style={styles.modalBtnText}>🔍 MDを解析して確認</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 14 }}>
                      検出結果: {mdParsedMeals.length}件
                    </Text>
                    <TouchableOpacity
                      onPress={() => setMdParsedMeals(null)}
                      style={{ backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}
                    >
                      <Text style={{ color: '#cbd5e1', fontSize: 11 }}>再編集</Text>
                    </TouchableOpacity>
                  </View>

                  {mdParsedMeals.map((item, idx) => {
                    const isSelected = mdSelectedIndices.includes(idx);
                    return (
                      <View
                        key={idx}
                        style={{
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : '#0f172a',
                          borderWidth: 1,
                          borderColor: isSelected ? '#10b981' : '#334155',
                          borderRadius: 8,
                          padding: 10,
                          gap: 6
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setMdSelectedIndices(prev =>
                                prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                              );
                            }}
                            style={{
                              width: 22, height: 22, borderRadius: 4,
                              backgroundColor: isSelected ? '#10b981' : '#334155',
                              justifyContent: 'center', alignItems: 'center'
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{isSelected ? '✓' : ''}</Text>
                          </TouchableOpacity>

                          <TextInput
                            style={[styles.input, { flex: 1, height: 36, fontSize: 13, fontWeight: 'bold', marginVertical: 0 }]}
                            value={item.name}
                            onChangeText={(text) => {
                              const copy = [...mdParsedMeals];
                              copy[idx].name = text;
                              setMdParsedMeals(copy);
                            }}
                            placeholder="食事名"
                            placeholderTextColor="#64748b"
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                          <View style={{ width: '31%' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>kcal</Text>
                            <TextInput
                              style={[styles.input, { height: 30, fontSize: 11, paddingHorizontal: 4, marginVertical: 0 }]}
                              keyboardType="numeric"
                              value={String(item.calories)}
                              onChangeText={(text) => {
                                const copy = [...mdParsedMeals];
                                copy[idx].calories = parseFloat(text) || 0;
                                setMdParsedMeals(copy);
                              }}
                            />
                          </View>
                          <View style={{ width: '31%' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>P(g)</Text>
                            <TextInput
                              style={[styles.input, { height: 30, fontSize: 11, paddingHorizontal: 4, marginVertical: 0 }]}
                              keyboardType="numeric"
                              value={String(item.protein)}
                              onChangeText={(text) => {
                                const copy = [...mdParsedMeals];
                                copy[idx].protein = parseFloat(text) || 0;
                                setMdParsedMeals(copy);
                              }}
                            />
                          </View>
                          <View style={{ width: '31%' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>F(g)</Text>
                            <TextInput
                              style={[styles.input, { height: 30, fontSize: 11, paddingHorizontal: 4, marginVertical: 0 }]}
                              keyboardType="numeric"
                              value={String(item.fat)}
                              onChangeText={(text) => {
                                const copy = [...mdParsedMeals];
                                copy[idx].fat = parseFloat(text) || 0;
                                setMdParsedMeals(copy);
                              }}
                            />
                          </View>
                          <View style={{ width: '31%' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>C(g)</Text>
                            <TextInput
                              style={[styles.input, { height: 30, fontSize: 11, paddingHorizontal: 4, marginVertical: 0 }]}
                              keyboardType="numeric"
                              value={String(item.carbs)}
                              onChangeText={(text) => {
                                const copy = [...mdParsedMeals];
                                copy[idx].carbs = parseFloat(text) || 0;
                                setMdParsedMeals(copy);
                              }}
                            />
                          </View>
                          <View style={{ width: '31%' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>繊維(g)</Text>
                            <TextInput
                              style={[styles.input, { height: 30, fontSize: 11, paddingHorizontal: 4, marginVertical: 0 }]}
                              keyboardType="numeric"
                              value={String(item.fiber)}
                              onChangeText={(text) => {
                                const copy = [...mdParsedMeals];
                                copy[idx].fiber = parseFloat(text) || 0;
                                setMdParsedMeals(copy);
                              }}
                            />
                          </View>
                          <View style={{ width: '31%' }}>
                            <Text style={{ color: '#64748b', fontSize: 10 }}>塩分(g)</Text>
                            <TextInput
                              style={[styles.input, { height: 30, fontSize: 11, paddingHorizontal: 4, marginVertical: 0 }]}
                              keyboardType="numeric"
                              value={String(item.sodium)}
                              onChangeText={(text) => {
                                const copy = [...mdParsedMeals];
                                copy[idx].sodium = parseFloat(text) || 0;
                                setMdParsedMeals(copy);
                              }}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: '#64748b', flex: 1 }]}
                      onPress={() => setIsMdModalOpen(false)}
                    >
                      <Text style={styles.modalBtnText}>キャンセル</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: mdSelectedIndices.length === 0 ? '#4b5563' : '#10b981', flex: 2 }]}
                      onPress={handleSaveParsedMdMeals}
                      disabled={mdSelectedIndices.length === 0}
                    >
                      <Text style={styles.modalBtnText}>✅ {mdSelectedIndices.length}件を一括登録</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 料理写真フルスクリーンプレビューモーダル */}
      <Modal visible={!!selectedPreviewPhoto} transparent animationType="fade">
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(5, 8, 16, 0.92)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16
          }}
          activeOpacity={1}
          onPress={() => setSelectedPreviewPhoto(null)}
        >
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 40,
              right: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              zIndex: 10
            }}
            onPress={() => setSelectedPreviewPhoto(null)}
          >
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>✕ 閉じる</Text>
          </TouchableOpacity>
          {selectedPreviewPhoto ? (
            <Image
              source={{ uri: selectedPreviewPhoto }}
              style={{
                width: '100%',
                height: '80%',
                resizeMode: 'contain',
                borderRadius: 12
              }}
            />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  appTitle: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: 'bold'
  },
  settingsButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  settingsButtonText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600'
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 16
  },
  dateNavButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6
  },
  dateNavText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold'
  },
  dateText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 13
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold'
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  pfcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6
  },
  pfcItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  pfcLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2
  },
  pfcVal: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold'
  },
  mealCardContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  mealCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  mealCardPhoto: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  mealCardInfo: {
    flex: 1
  },
  mealName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2
  },
  mealDetail: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600'
  },
  mealMemo: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  mealCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  actionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  actionChipText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 13
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    gap: 8
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 20
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12
  },
  modeTabContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14
  },
  modeTab: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  activeModeTab: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  modeTabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  activeModeTabText: {
    color: '#ffffff'
  },
  cameraBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  cameraActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  cameraActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  previewContainer: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative'
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  analyzingText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center'
  },
  portionBox: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  portionTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8
  },
  portionBtnRow: {
    flexDirection: 'row',
    gap: 6
  },
  portionBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  activePortionBtn: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  portionBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold'
  },
  activePortionBtnText: {
    color: '#ffffff'
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 6
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
    marginBottom: 6
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    marginBottom: 16
  },
  mealTypeBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  activeMealTypeBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  mealTypeBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  activeMealTypeBtnText: {
    color: '#ffffff'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },
  saveBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
