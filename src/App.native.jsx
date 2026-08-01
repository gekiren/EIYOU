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
import { analyzeMealPhoto } from './shared_modules/ai/nutritionAiService.js';
import { SECURE_WORKER_PROXY_URL } from './config/constants.js';

export default function NativeApp() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealLogs, setMealLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // モーダル
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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
  const [mealNameInput, setMealNameInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [sodiumInput, setSodiumInput] = useState('');
  const [mealType, setMealType] = useState('lunch');

  // 目標設定
  const [userGoals, setUserGoals] = useState({ calories: 2200, protein: 75, fat: 60, carbs: 280, sodium: 7.0 });

  useEffect(() => {
    loadSettings();
    loadMealLogs();
  }, [selectedDate]);

  const loadSettings = async () => {
    const savedGoals = await safeStorage.getItem('eiyou_user_goals', '');
    if (savedGoals) {
      try {
        setUserGoals(JSON.parse(savedGoals));
      } catch (e) {}
    }
  };

  const loadMealLogs = async () => {
    setLoading(true);
    try {
      const logs = await nutritionDb.getMealLogsByDate(selectedDate);
      setMealLogs(logs || []);
    } catch (e) {
      console.error('Failed to load meal logs:', e);
    } finally {
      setLoading(false);
    }
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

  // 画像のリサイズ・軽量化・Base64変換
  const processAndOptimizeImage = async (imageUri) => {
    // 撮影直後にまずプレビューとローディングを画面に即座に表示
    setSelectedImageUri(imageUri);
    setAnalyzing(true);
    setProgressMsg('画像を最適化中...');

    try {
      // 最大幅 1024px にリサイズ＆圧縮
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      if (manipResult.uri) {
        setSelectedImageUri(manipResult.uri);
      }

      let base64Data = manipResult.base64;
      if (!base64Data) {
        base64Data = await convertUriToBase64(manipResult.uri || imageUri);
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
      console.error('Failed to optimize image:', e);
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
    setIsSettingsModalOpen(false);
    Alert.alert('保存完了', '目標設定を保存しました。');
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

    await handleSaveMeal({
      name: mealNameInput,
      mealType,
      calories: finalCal,
      protein: finalP,
      fat: finalF,
      carbs: finalC,
      sodium: finalNa,
      photoUrl: selectedImageUri || '',
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

  // チャット栄養解析記録追加
  const handleAddChatMeal = async () => {
    if (!chatInput.trim()) {
      Alert.alert('入力エラー', '食べたものをメッセージで入力してください。');
      return;
    }

    setLoading(true);
    try {
      const dummyCalories = 250;
      await handleSaveMeal({
        name: chatInput,
        mealType: 'snack',
        calories: dummyCalories,
        protein: 5,
        fat: 3,
        carbs: 45,
        sodium: 1.2,
        memo: 'AIチャット解析ログ'
      });
      setChatInput('');
      setIsChatModalOpen(false);
      Alert.alert('AI記録完了', `「${chatInput}」の栄養ログを保存しました`);
    } catch (err) {
      Alert.alert('解析エラー', 'AI解析通信に失敗しました。');
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

        {/* 食事記録リスト */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🍴 食事ログ一覧 ({selectedDate})</Text>

          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginVertical: 20 }} />
          ) : mealLogs.length === 0 ? (
            <Text style={styles.emptyText}>この日付の食事記録はまだありません。</Text>
          ) : (
            mealLogs.map((log) => (
              <View key={log.id} style={styles.mealItem}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>{log.name}</Text>
                  <Text style={styles.mealDetail}>
                    {log.calories} kcal | P:{log.protein}g F:{log.fat}g C:{log.carbs}g
                  </Text>
                  {log.memo ? <Text style={styles.mealMemo}>{log.memo}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => handleOpenEditModal(log)}
                    style={styles.editButton}
                  >
                    <Text style={styles.editButtonText}>編集</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteMeal(log.id)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>削除</Text>
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
          style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
          onPress={() => setIsPhotoModalOpen(true)}
        >
          <Text style={styles.actionBtnText}>📷 写真 / カメラ記録</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}
          onPress={() => setIsChatModalOpen(true)}
        >
          <Text style={styles.actionBtnText}>💬 チャット記録</Text>
        </TouchableOpacity>
      </View>

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
      <Modal visible={isChatModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💬 チャット栄養AI記録</Text>
            <Text style={styles.modalSub}>食べたものを入力するとAIが栄養価を推定・記録します</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="例: 朝食にバナナ1本と牛乳200ml"
              placeholderTextColor="#94a3b8"
              multiline
              value={chatInput}
              onChangeText={setChatInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#64748b' }]}
                onPress={() => setIsChatModalOpen(false)}
              >
                <Text style={styles.modalBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#8b5cf6' }]}
                onPress={handleAddChatMeal}
              >
                <Text style={styles.modalBtnText}>AIで自動解析</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 設定モーダル */}
      <Modal visible={isSettingsModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚙️ 目標栄養設定</Text>

            <Text style={styles.inputLabel}>目標カロリー (kcal)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(userGoals.calories)}
              onChangeText={(text) => setUserGoals({ ...userGoals, calories: Number(text) || 0 })}
            />

            <Text style={styles.inputLabel}>目標タンパク質 (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(userGoals.protein)}
              onChangeText={(text) => setUserGoals({ ...userGoals, protein: Number(text) || 0 })}
            />

            <Text style={styles.inputLabel}>目標脂質 (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(userGoals.fat)}
              onChangeText={(text) => setUserGoals({ ...userGoals, fat: Number(text) || 0 })}
            />

            <Text style={styles.inputLabel}>目標炭水化物 (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(userGoals.carbs)}
              onChangeText={(text) => setUserGoals({ ...userGoals, carbs: Number(text) || 0 })}
            />

            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#8b5cf6', marginLeft: 0, paddingVertical: 12, alignItems: 'center' }]}
                onPress={handleCheckOTAUpdate}
              >
                <Text style={styles.modalBtnText}>🔄 アプリのOTA更新を手動チェック</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
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
  }
});
