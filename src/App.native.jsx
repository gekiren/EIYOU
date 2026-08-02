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
import HistoryChartCard from './components/HistoryChartCard.native.jsx';


if (typeof window !== 'undefined' && FileSystem && FileSystem.StorageAccessFramework) {
  window.expoFileSystemSAF = { StorageAccessFramework: FileSystem.StorageAccessFramework };
}

export default function NativeApp() {
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
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState(null); // 写真フルスクリーンプレビュー用

  // 履歴追加用ステート
  const [allHistoryLogs, setAllHistoryLogs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyTab, setHistoryTab] = useState('favorites'); // 'favorites' | 'recent' | 'frequent' | 'breakfast' | 'lunch' | 'dinner' | 'snack'
  const [historyTargetMealType, setHistoryTargetMealType] = useState('lunch');

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
  const [chatAnalyzing, setChatAnalyzing] = useState(false); // AI解析中フラグ
  const [chatAnalyzedData, setChatAnalyzedData] = useState(null); // AI解析結果プレビュー
  const [chatMealType, setChatMealType] = useState('lunch'); // 食事タイプ選択
  const [mealNameInput, setMealNameInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [sodiumInput, setSodiumInput] = useState('');
  const [mealType, setMealType] = useState('lunch');

  // 目標達成許容範囲のデフォルト値
  const DEFAULT_TOLERANCES = {
    calories: { min: -10, max: 5 },
    protein: { min: -15, max: 20 },
    fat: { min: -15, max: 15 },
    carbs: { min: -15, max: 15 },
    sodium: { min: -100, max: 0 },
  };

  // 目標設定
  const [userGoals, setUserGoals] = useState({
    calories: 2200,
    protein: 75,
    fat: 60,
    carbs: 280,
    sodium: 7.0,
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
    await nutritionDb.toggleFavorite(mealItem);
    await loadFavorites();
  };

  const handleOpenHistoryModal = async () => {
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
    // 撮影直後にプレビューを表示
    setSelectedImageUri(imageUri);
    setAnalyzing(true);
    setProgressMsg('AI用に画像を軽量最適化中...');

    try {
      // 1. プレビュー & 保存用URIの作成 (最大幅600px, 圧縮率0.7)
      const previewManip = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (previewManip.uri) {
        setSelectedImageUri(previewManip.uri);
      }

      // 2. AI送信用超軽量Base64の作成 (最大幅512px, 圧縮率0.5 で通信量を約30〜70KBに激減)
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
      // フォールバック: 元の画像URIでBase64を直接試みる
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

  // カメラ撮影処理 (Modal非同期描画ロック防止 ＆ ハイブリッド自動フォールバック付き)
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'カメラを使用するにはカメラへのアクセス許可が必要です。');
        return;
      }

      // AndroidのModal描画ロック防止のため、カメラ起動前にモーダルを一時隠す
      setIsPhotoModalOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 150));

      let result;
      try {
        // まずクロップあり (allowsEditing: true) を試行
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8
        });
      } catch (cropErr) {
        console.warn('Native Crop Intent failed, falling back to non-crop camera mode:', cropErr);
        // 端末のクロップIntentが失敗した場合はクロップなし (allowsEditing: false) で安全撮影
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8
        });
      }

      // 撮影完了・復帰後にモーダルを再表示
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

      // Modal描画ロック防止のため、ギャラリー起動前にモーダルを一時隠す
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

  // AI写真解析実行 (Worker Proxy 経由)
  const runAiAnalysis = async (imgBase64) => {
    setAnalyzing(true);
    setProgressMsg(recordMode === 'ocr' ? 'OCR & 栄養表示ラベルを解析中...' : 'AIで料理写真から料理名・栄養価を判定中...');

    try {
      const res = await analyzeMealPhoto({
        base64Image: imgBase64,
        workerProxyUrl: SECURE_WORKER_PROXY_URL,
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
      } else {
        // デフォルト推定セット
        const defaultName = recordMode === 'ocr' ? '栄養成分表示食品' : '記録写真料理';
        setMealNameInput(defaultName);
        setCaloriesInput('550');
        setProteinInput('22.0');
        setFatInput('16.0');
        setCarbsInput('75.0');
        setSodiumInput('2.1');
      }
    } catch (err) {
      console.warn('AI Analysis Warning:', err);
      // 通信エラー時もフォームを自動入力して調整可能にする
      const fallbackName = recordMode === 'ocr' ? '栄養成分表示食品' : '写真解析料理';
      setMealNameInput(fallbackName);
      setCaloriesInput('480');
      setProteinInput('18.5');
      setFatInput('14.0');
      setCarbsInput('65.0');
      setSodiumInput('1.8');
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
      sodium: acc.sodium + (Number(log.sodium) || 0)
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0 }
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
      memo: editMemo
    });

    setIsEditModalOpen(false);
    setEditingMealLog(null);
    await loadMealLogs();
  };

  const handleSaveSettings = async () => {
    await safeStorage.setItem('eiyou_user_goals', JSON.stringify(userGoals));
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

  // OTA手動アップデートチェック処理
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

  // 写真・手動モーダルからの保存実行
  const handleSavePhotoMealRecord = async () => {
    if (!mealNameInput.trim()) {
      Alert.alert('入力エラー', '食品・料理名を入力してください。');
      return;
    }

    // 倍率/割合を掛け合わせた最終栄養数値を計算
    const mult = recordMode === 'ocr' ? portionPercentage / 100 : portionMultiplier;

    const finalCal = Math.round((Number(caloriesInput) || 0) * mult);
    const finalP = Number(((Number(proteinInput) || 0) * mult).toFixed(1));
    const finalF = Number(((Number(fatInput) || 0) * mult).toFixed(1));
    const finalC = Number(((Number(carbsInput) || 0) * mult).toFixed(1));
    const finalNa = Number(((Number(sodiumInput) || 0) * mult).toFixed(1));

    // 選択された写真を永続ストレージ(FileSystem.documentDirectory)に保存
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
      photoUrl: permanentPhotoPath || selectedImageUri || '',
      memo: recordMode === 'ocr' ? `【成分表示モード】摂取量: ${portionPercentage}%` : `【料理写真モード】量: ${portionMultiplier}倍`
    });

    // リセット
    setSelectedImageUri(null);
    setBase64Image(null);
    setAiAnalysisResult(null);
    setMealNameInput('');
    setCaloriesInput('');
    setProteinInput('');
    setFatInput('');
    setCarbsInput('');
    setSodiumInput('');
    setPortionMultiplier(1.0);
    setPortionPercentage(100);
    setIsPhotoModalOpen(false);
  };

  // チャット: AI解析フェーズ（解析結果をプレビュー表示）
  const handleAnalyzeChatMeal = async () => {
    if (!chatInput.trim() || chatAnalyzing) return;
    setChatAnalyzing(true);
    setChatAnalyzedData(null);
    try {
      const parsedData = await analyzeMealTextWithAI({
        textInput: chatInput.trim(),
        workerProxyUrl: SECURE_WORKER_PROXY_URL
      });
      setChatAnalyzedData(parsedData);
    } catch (err) {
      console.error('Chat analysis error:', err);
      Alert.alert('解析エラー', 'AI解析に失敗しました: ' + (err.message || ''));
    } finally {
      setChatAnalyzing(false);
    }
  };

  // チャット: 確認後に保存フェーズ
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
      await handleSaveMeal({
        name: mealName,
        mealType: chatMealType,
        calories,
        protein,
        fat,
        carbs,
        sodium,
        memo: chatAnalyzedData.advice ? `AI解析: ${chatAnalyzedData.advice}` : 'AIチャット解析ログ'
      });
      setChatInput('');
      setChatAnalyzedData(null);
      setChatMealType('lunch');
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
              <Text style={styles.pfcLabel}>食塩相当量</Text>
              <Text style={styles.pfcVal}>{totals.sodium.toFixed(1)} / {userGoals.sodium}g</Text>
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
                {/* 上段: 料理写真 + テキスト広幅表示 */}
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
                      {log.calories} kcal | P:{log.protein}g F:{log.fat}g C:{log.carbs}g
                    </Text>
                    {log.memo ? <Text style={styles.mealMemo}>{log.memo}</Text> : null}
                  </View>
                </View>

                {/* 下段: アクションボタンエリア */}
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

            {/* 追加先区分選択 */}
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

            {/* 検索入力 */}
            <TextInput
              style={[styles.input, { marginBottom: 10 }]}
              placeholder="料理名で検索..."
              placeholderTextColor="#94a3b8"
              value={historySearchQuery}
              onChangeText={setHistorySearchQuery}
            />

            {/* カテゴリ/ソートタブ */}
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

            {/* 履歴・お気に入りリスト */}
            <ScrollView style={{ flex: 1, maxHeight: 380 }}>
              {(() => {
                let filtered = allHistoryLogs;
                if (historyTab === 'favorites') {
                  filtered = favorites;
                } else if (historyTab === 'frequent') {
                  const map = new Map();
                  allHistoryLogs.forEach((item) => {
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
                  filtered = allHistoryLogs.filter((log) => log.mealType === historyTab);
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
                          {item.calories} kcal | P:{item.protein}g F:{item.fat}g C:{item.carbs}g
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
                              calories: Number(item.calories) || 0,
                              protein: Number(item.protein) || 0,
                              fat: Number(item.fat) || 0,
                              carbs: Number(item.carbs) || 0,
                              sodium: Number(item.sodium) || 0,
                              photoUrl: item.photoUrl || '',
                              memo: item.memo ? `(履歴追加) ${item.memo}` : '履歴追加'
                            });
                            Alert.alert('追加完了', `「${item.name}」を${selectedDate}に追加しました`);
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

              {/* 撮影モード選択タブ */}
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

              {/* モード別のカメラ・ボタン案内 */}
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

              {/* 写真プレビュー & AI解析中スピナー */}
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

              {/* 量の調整コントローラー */}
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

              {/* フォーム調整入力 */}
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
                  <Text style={styles.modalBtnText}>
                    {recordMode === 'ocr'
                      ? `記録 (${portionPercentage}%)`
                      : recordMode === 'dish'
                      ? `記録 (${portionMultiplier}倍)`
                      : '手動保存'}
                  </Text>
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
            setIsChatModalOpen(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>💬 チャット栄養AI記録</Text>

            {/* フェーズ1: テキスト入力 */}
            {!chatAnalyzedData && (
              <>
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
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                    onPress={() => {
                      setChatInput('');
                      setChatAnalyzedData(null);
                      setChatMealType('lunch');
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
              </>
            )}

            {/* フェーズ2: 解析結果確認 */}
            {chatAnalyzedData && (
              <>
                <Text style={[styles.modalSub, { color: '#34d399' }]}>✅ AI解析完了 — 内容を確認してください</Text>

                {/* 食事名 */}
                <View style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#334155' }}>
                  <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>🍽 {chatAnalyzedData.mealName}</Text>

                  {/* 栄養価グリッド */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {[
                      { label: 'カロリー', value: chatAnalyzedData.calories, unit: 'kcal', color: '#f59e0b' },
                      { label: 'タンパク質', value: chatAnalyzedData.protein, unit: 'g', color: '#3b82f6' },
                      { label: '脂質', value: chatAnalyzedData.fat, unit: 'g', color: '#ef4444' },
                      { label: '炭水化物', value: chatAnalyzedData.carbs, unit: 'g', color: '#8b5cf6' },
                      { label: '塩分', value: chatAnalyzedData.sodium, unit: 'g', color: '#64748b' },
                    ].map(item => (
                      <View key={item.label} style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 8, minWidth: '28%', alignItems: 'center', borderWidth: 1, borderColor: item.color + '44' }}>
                        <Text style={{ color: item.color, fontSize: 11, marginBottom: 2 }}>{item.label}</Text>
                        <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 'bold' }}>{item.value}</Text>
                        <Text style={{ color: '#64748b', fontSize: 10 }}>{item.unit}</Text>
                      </View>
                    ))}
                  </View>

                  {/* アドバイス */}
                  {chatAnalyzedData.advice && (
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>💡 {chatAnalyzedData.advice}</Text>
                  )}
                </View>

                {/* 食事タイプ選択 */}
                <Text style={[styles.inputLabel, { marginBottom: 4 }]}>食事の種類</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {[
                    { key: 'breakfast', label: '🌅 朝食' },
                    { key: 'lunch', label: '☀️ 昼食' },
                    { key: 'dinner', label: '🌙 夕食' },
                    { key: 'snack', label: '🍪 間食' },
                  ].map(type => (
                    <TouchableOpacity
                      key={type.key}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: chatMealType === type.key ? '#8b5cf6' : '#1e293b',
                        borderWidth: 1,
                        borderColor: chatMealType === type.key ? '#8b5cf6' : '#334155',
                      }}
                      onPress={() => setChatMealType(type.key)}
                    >
                      <Text style={{ color: chatMealType === type.key ? '#fff' : '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#334155' }]}
                    onPress={() => setChatAnalyzedData(null)}
                    disabled={loading}
                  >
                    <Text style={styles.modalBtnText}>↩ やり直す</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: loading ? '#1a6b4a' : '#10b981' }]}
                    onPress={handleConfirmChatMeal}
                    disabled={loading}
                  >
                    <Text style={styles.modalBtnText}>{loading ? '保存中...' : '✅ 保存する'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>

      {/* 設定モーダル */}
      <Modal visible={isSettingsModalOpen} animationType="slide" transparent onRequestClose={() => setIsSettingsModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 45 }}>
          <View style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155', display: 'flex', flexDirection: 'column' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>⚙️ アプリ設定</Text>
              <TouchableOpacity onPress={() => setIsSettingsModalOpen(false)}>
                <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold', padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* タブナビゲーション */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 8 }}>
              {[
                { key: 'goals', label: '🎯 栄養目標' },
                { key: 'obsidian', label: '📄 Obsidian' },
                { key: 'data', label: '📁 その他' }
              ].map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: settingsTab === tab.key ? '#334155' : 'transparent'
                  }}
                  onPress={() => setSettingsTab(tab.key)}
                >
                  <Text style={{
                    color: settingsTab === tab.key ? (tab.key === 'goals' ? '#38bdf8' : tab.key === 'obsidian' ? '#c084fc' : '#34d399') : '#94a3b8',
                    fontWeight: 'bold',
                    fontSize: 13
                  }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ paddingBottom: 24 }}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. 栄養目標設定タブ */}
              {settingsTab === 'goals' && (
                <View>
                  <Text style={[styles.inputLabel, { color: '#38bdf8', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }]}>
                    🎯 日別栄養目標の設定
                  </Text>

                  {/* モード選択タブ */}
                  <Text style={[styles.inputLabel, { fontSize: 12, color: '#94a3b8', marginBottom: 6 }]}>設定方法の選択</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 8, padding: 3, marginBottom: 16 }}>
                    {[
                      { key: 'calorie_pfc', label: '1. カロリー+%' },
                      { key: 'pfc_gram', label: '2. PFC(g)直接' },
                      { key: 'protein_pfc', label: '3. P(g)+%' }
                    ].map(m => (
                      <TouchableOpacity
                        key={m.key}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 6,
                          alignItems: 'center',
                          backgroundColor: goalMode === m.key ? 'rgba(56, 189, 248, 0.25)' : 'transparent'
                        }}
                        onPress={() => setGoalMode(m.key)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: goalMode === m.key ? '#38bdf8' : '#94a3b8' }}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* モード1: カロリー ＆ PFC% 指定 */}
                  {goalMode === 'calorie_pfc' && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={styles.inputLabel}>目標カロリー (kcal)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(userGoals.calories)}
                        onChangeText={(text) => handleCalorieAndRatioChangeNative(text, undefined, undefined, undefined)}
                      />

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: '#60a5fa', fontSize: 12 }]}>P (タンパク質 %)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(pRatio)}
                            onChangeText={(text) => handleCalorieAndRatioChangeNative(undefined, text, undefined, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: '#f87171', fontSize: 12 }]}>F (脂質 %)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(fRatio)}
                            onChangeText={(text) => handleCalorieAndRatioChangeNative(undefined, undefined, text, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: '#fbbf24', fontSize: 12 }]}>C (炭水化物 %)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(cRatio)}
                            onChangeText={(text) => handleCalorieAndRatioChangeNative(undefined, undefined, undefined, text)}
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* モード2: PFC(g) 直接指定 */}
                  {goalMode === 'pfc_gram' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: '#60a5fa', fontSize: 12 }]}>タンパク質 (g)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={String(userGoals.protein)}
                          onChangeText={(text) => handleGramChangeNative(text, undefined, undefined)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: '#f87171', fontSize: 12 }]}>脂質 (g)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={String(userGoals.fat)}
                          onChangeText={(text) => handleGramChangeNative(undefined, text, undefined)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: '#fbbf24', fontSize: 12 }]}>炭水化物 (g)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          value={String(userGoals.carbs)}
                          onChangeText={(text) => handleGramChangeNative(undefined, undefined, text)}
                        />
                      </View>
                    </View>
                  )}

                  {/* モード3: P(g) ＆ PFC% 指定 */}
                  {goalMode === 'protein_pfc' && (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={[styles.inputLabel, { color: '#60a5fa' }]}>タンパク質 (g)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(userGoals.protein)}
                        onChangeText={(text) => handleProteinAndRatioChangeNative(text, undefined, undefined, undefined)}
                      />

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: '#60a5fa', fontSize: 12 }]}>P (割合 %)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(pRatio)}
                            onChangeText={(text) => handleProteinAndRatioChangeNative(undefined, text, undefined, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: '#f87171', fontSize: 12 }]}>F (割合 %)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(fRatio)}
                            onChangeText={(text) => handleProteinAndRatioChangeNative(undefined, undefined, text, undefined)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: '#fbbf24', fontSize: 12 }]}>C (割合 %)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={String(cRatio)}
                            onChangeText={(text) => handleProteinAndRatioChangeNative(undefined, undefined, undefined, text)}
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* サマリーカード */}
                  <View style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>📊 決定される目標値とPFC比率</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 14 }}>🔥 {userGoals.calories} kcal</Text>
                      <Text style={{ color: '#60a5fa', fontSize: 13 }}>P: {userGoals.protein}g ({pRatio}%)</Text>
                      <Text style={{ color: '#f87171', fontSize: 13 }}>F: {userGoals.fat}g ({fRatio}%)</Text>
                      <Text style={{ color: '#fbbf24', fontSize: 13 }}>C: {userGoals.carbs}g ({cRatio}%)</Text>
                    </View>
                    {(Number(pRatio) + Number(fRatio) + Number(cRatio) !== 100) && (goalMode === 'calorie_pfc' || goalMode === 'protein_pfc') && (
                      <Text style={{ fontSize: 11, color: '#f87171', marginTop: 6, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        ⚠️ PFC比率の合計が 100% になっていません (現在: {Number(pRatio) + Number(fRatio) + Number(cRatio)}%)
                      </Text>
                    )}
                  </View>

                  {/* 🎯 達成許容範囲設定 (-% 〜 +%) */}
                  <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#38bdf8', marginBottom: 4 }}>
                      🎯 栄養素別 目標達成許容範囲 (-% 〜 +%)
                    </Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                      推移グラフで「達成（適正）」と判定されるマイナス％・プラス％の許容幅を設定します。
                    </Text>

                    {[
                      { key: 'calories', label: 'カロリー' },
                      { key: 'protein', label: 'タンパク質' },
                      { key: 'fat', label: '脂質' },
                      { key: 'carbs', label: '炭水化物' },
                      { key: 'sodium', label: '塩分' },
                    ].map(item => {
                      const tol = userGoals.tolerances?.[item.key] || DEFAULT_TOLERANCES[item.key] || { min: -10, max: 10 };
                      return (
                        <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, color: '#f8fafc', width: 75 }}>{item.label}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>下限:</Text>
                            <TextInput
                              style={[styles.input, { width: 55, paddingVertical: 4, paddingHorizontal: 6, marginBottom: 0, textAlign: 'center', fontSize: 12 }]}
                              keyboardType="numeric"
                              value={String(tol.min)}
                              onChangeText={(val) => handleToleranceChange(item.key, 'min', val)}
                            />
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>% 〜</Text>
                            <Text style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>上限:</Text>
                            <TextInput
                              style={[styles.input, { width: 55, paddingVertical: 4, paddingHorizontal: 6, marginBottom: 0, textAlign: 'center', fontSize: 12 }]}
                              keyboardType="numeric"
                              value={String(tol.max)}
                              onChangeText={(val) => handleToleranceChange(item.key, 'max', val)}
                            />
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 2. Obsidian Vault 自動連携設定タブ */}
              {settingsTab === 'obsidian' && (
                <View style={{ padding: 12, borderRadius: 10, backgroundColor: 'rgba(30, 41, 59, 0.6)', borderWidth: 1, borderColor: '#334155' }}>
                  <Text style={[styles.inputLabel, { color: '#c084fc', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }]}>
                    📄 Obsidian Vault 自動連携設定
                  </Text>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                    onPress={() => setObsidianEnabled(!obsidianEnabled)}
                  >
                    <Text style={{ color: '#f8fafc', fontSize: 14 }}>Obsidian 自動連携</Text>
                    <Text style={{ color: obsidianEnabled ? '#c084fc' : '#94a3b8', fontWeight: 'bold' }}>
                      {obsidianEnabled ? '有効 (ON)' : '無効 (OFF)'}
                    </Text>
                  </TouchableOpacity>

                  {obsidianEnabled && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.inputLabel}>Obsidian Vault 保存先フォルダ</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: '#0f172a' }]}
                          value={obsidianVaultUri || '未選択 (SAFで選択)'}
                          editable={false}
                        />
                        <TouchableOpacity
                          style={[styles.modalBtn, { backgroundColor: '#8b5cf6', paddingHorizontal: 12, paddingVertical: 10 }]}
                          onPress={handleSelectVaultFolder}
                        >
                          <Text style={styles.modalBtnText}>フォルダ選択</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.inputLabel}>保存モード選択</Text>
                      {[
                        { key: 'dedicated', label: 'a) 専用ノート (EIYOU_YYYY-MM-DD.md)' },
                        { key: 'append', label: 'b) デイリーノート追記 (Daily/YYYY-MM-DD.md)' },
                        { key: 'individual', label: 'c) 個別ノート (EIYOU_Nutrition_Log.md)' }
                      ].map(item => (
                        <TouchableOpacity
                          key={item.key}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                          onPress={() => setObsidianSaveMode(item.key)}
                        >
                          <Text style={{ color: obsidianSaveMode === item.key ? '#c084fc' : '#94a3b8', marginRight: 8, fontSize: 16 }}>
                            {obsidianSaveMode === item.key ? '🔘' : '⚪'}
                          </Text>
                          <Text style={{ color: '#f8fafc', fontSize: 13 }}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}

                      <Text style={[styles.inputLabel, { marginTop: 10 }]}>保存先サブフォルダ名</Text>
                      <TextInput
                        style={styles.input}
                        value={obsidianFolderName}
                        onChangeText={setObsidianFolderName}
                        placeholder="EIYOU"
                        placeholderTextColor="#64748b"
                      />

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                      onPress={() => setObsidianAutoSyncOnLaunch(!obsidianAutoSyncOnLaunch)}
                    >
                      <Text style={{ color: '#f8fafc', fontSize: 13 }}>起動時に自動一括同期</Text>
                      <Text style={{ color: obsidianAutoSyncOnLaunch ? '#c084fc' : '#94a3b8' }}>
                        {obsidianAutoSyncOnLaunch ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalBtn, { backgroundColor: 'rgba(139, 92, 246, 0.3)', borderColor: '#8b5cf6', borderWidth: 1, marginLeft: 0, marginTop: 10, paddingVertical: 10, alignItems: 'center' }]}
                      onPress={handleManualSyncAll}
                    >
                      <Text style={[styles.modalBtnText, { color: '#c084fc' }]}>全食事ログを今すぐ Obsidian へ同期</Text>
                    </TouchableOpacity>

                    {syncStatusMsg ? (
                      <Text style={{ color: '#38bdf8', fontSize: 12, marginTop: 6 }}>{syncStatusMsg}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            {/* 3. データ・その他タブ */}
            {settingsTab === 'data' && (
              <View>
                <Text style={[styles.inputLabel, { color: '#34d399', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }]}>
                  📁 データ & システム設定
                </Text>

                <View style={{ marginTop: 12, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#8b5cf6', marginLeft: 0, paddingVertical: 12, alignItems: 'center' }]}
                    onPress={handleCheckOTAUpdate}
                  >
                    <Text style={styles.modalBtnText}>🔄 アプリのOTA更新を手動チェック</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            </ScrollView>

            <View style={[styles.modalButtons, { width: '100%', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }]}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                onPress={() => setIsSettingsModalOpen(false)}
              >
                <Text style={styles.modalBtnText}>閉じる</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#3b82f6' }]}
                onPress={handleSaveSettings}
              >
                <Text style={styles.modalBtnText}>設定保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✏️ 食事記録 編集モーダル */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>✏️ 食事ログの編集</Text>

              {/* 食事区分選択 */}
              <Text style={styles.inputLabel}>食事区分</Text>
              <View style={styles.modeTabContainer}>
                {[
                  { key: 'breakfast', label: '朝食' },
                  { key: 'lunch', label: '昼食' },
                  { key: 'dinner', label: '夕食' },
                  { key: 'snack', label: '間食' }
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.modeTab, editMealType === item.key && styles.activeModeTab]}
                    onPress={() => setEditMealType(item.key)}
                  >
                    <Text style={[styles.modeTabText, editMealType === item.key && styles.activeModeTabText]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>食品・料理名</Text>
              <TextInput
                style={styles.input}
                placeholder="例: 鮭おにぎり"
                placeholderTextColor="#94a3b8"
                value={editMealName}
                onChangeText={setEditMealName}
              />

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

              <Text style={styles.inputLabel}>食塩相当量 (g)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editSodium}
                onChangeText={setEditSodium}
              />

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
              style={{ width: '92%', height: '75%', borderRadius: 16 }}
              resizeMode="contain"
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
    padding: 16,
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
    borderRadius: 6
  },
  settingsButtonText: {
    color: '#e2e8f0',
    fontSize: 14
  },
  dateSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12
  },
  dateNavButton: {
    padding: 8
  },
  dateNavText: {
    color: '#38bdf8',
    fontSize: 16
  },
  dateText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16
  },
  scrollContent: {
    padding: 16
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
    marginBottom: 6
  },
  metricLabel: {
    color: '#94a3b8'
  },
  metricValue: {
    color: '#38bdf8',
    fontWeight: 'bold'
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#334155',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5
  },
  pfcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  pfcItem: {
    width: '48%',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8
  },
  pfcLabel: {
    color: '#94a3b8',
    fontSize: 12
  },
  pfcVal: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 20
  },
  mealCardContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  mealCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  mealCardPhoto: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  mealCardInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  mealCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  mealInfo: {
    flex: 1
  },
  mealName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600'
  },
  mealDetail: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  mealMemo: {
    color: '#38bdf8',
    fontSize: 11,
    marginTop: 2
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 12
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155'
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14
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
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 4,
    marginBottom: 14
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6
  },
  activeModeTab: {
    backgroundColor: '#3b82f6'
  },
  modeTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  activeModeTabText: {
    color: '#ffffff'
  },
  cameraBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  cameraActionBtn: {
    flex: 0.48,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  cameraActionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13
  },
  previewContainer: {
    position: 'relative',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  analyzingText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    marginTop: 8,
    fontSize: 13
  },
  portionBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12
  },
  portionTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6
  },
  portionBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  portionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  activePortionBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981'
  },
  portionBtnText: {
    color: '#94a3b8',
    fontSize: 12
  },
  activePortionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 2
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8
  },
  rowInputs: {
    flexDirection: 'row'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8
  },
  modalBtnText: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155'
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
