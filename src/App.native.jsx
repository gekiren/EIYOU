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
  ActivityIndicator
} from 'react-native';
import { safeStorage } from './shared_modules/storage/safeStorage.js';
import { nutritionDb } from './shared_modules/db/nutritionDb.js';

export default function NativeApp() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealLogs, setMealLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // モーダル
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // 手動 / チャット食事追加用入力
  const [chatInput, setChatInput] = useState('');
  const [mealNameInput, setMealNameInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [sodiumInput, setSodiumInput] = useState('');
  const [mealType, setMealType] = useState('lunch');

  // 設定
  const [apiKeys, setApiKeys] = useState({ geminiKey: '', deepSeekKey: '', workerUrl: '' });
  const [userGoals, setUserGoals] = useState({ calories: 2200, protein: 75, fat: 60, carbs: 280, sodium: 7.0 });

  useEffect(() => {
    loadSettings();
    loadMealLogs();
  }, [selectedDate]);

  const loadSettings = async () => {
    const geminiKey = await safeStorage.getItem('eiyou_gemini_key', '');
    const deepSeekKey = await safeStorage.getItem('eiyou_deepseek_key', '');
    const workerUrl = await safeStorage.getItem('eiyou_worker_url', '');
    setApiKeys({ geminiKey, deepSeekKey, workerUrl });

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

  // 目標進捗の計算
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

  const handleSaveSettings = async () => {
    await safeStorage.setItem('eiyou_gemini_key', apiKeys.geminiKey);
    await safeStorage.setItem('eiyou_deepseek_key', apiKeys.deepSeekKey);
    await safeStorage.setItem('eiyou_worker_url', apiKeys.workerUrl);
    await safeStorage.setItem('eiyou_user_goals', JSON.stringify(userGoals));
    setIsSettingsModalOpen(false);
    Alert.alert('保存完了', '設定を保存しました。');
  };

  // 手動記録追加
  const handleAddManualMeal = async () => {
    if (!mealNameInput.trim()) {
      Alert.alert('入力エラー', '食品名を入力してください。');
      return;
    }
    await handleSaveMeal({
      name: mealNameInput,
      mealType,
      calories: Number(caloriesInput) || 0,
      protein: Number(proteinInput) || 0,
      fat: Number(fatInput) || 0,
      carbs: Number(carbsInput) || 0,
      sodium: Number(sodiumInput) || 0
    });
    setMealNameInput('');
    setCaloriesInput('');
    setProteinInput('');
    setFatInput('');
    setCarbsInput('');
    setSodiumInput('');
    setIsPhotoModalOpen(false);
  };

  // チャット模擬解析記録追加
  const handleAddChatMeal = async () => {
    if (!chatInput.trim()) {
      Alert.alert('入力エラー', '食べたものをメッセージで入力してください。');
      return;
    }
    // AIテキスト解析フォールバック（例: おにぎり→200kcal）
    const dummyCalories = 250;
    await handleSaveMeal({
      name: chatInput,
      mealType: 'snack',
      calories: dummyCalories,
      protein: 5,
      fat: 3,
      carbs: 45,
      sodium: 1.2,
      memo: 'チャット記録'
    });
    setChatInput('');
    setIsChatModalOpen(false);
    Alert.alert('記録完了', `「${chatInput}」を記録しました (${dummyCalories} kcal)`);
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
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteMeal(log.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>削除</Text>
                </TouchableOpacity>
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
          <Text style={styles.actionBtnText}>📷 写真/手動で記録</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}
          onPress={() => setIsChatModalOpen(true)}
        >
          <Text style={styles.actionBtnText}>💬 チャットで記録</Text>
        </TouchableOpacity>
      </View>

      {/* 手動・写真記録モーダル */}
      <Modal visible={isPhotoModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>新規食事の記録</Text>
            <TextInput
              style={styles.input}
              placeholder="食品名 (例: 鮭おにぎり)"
              placeholderTextColor="#94a3b8"
              value={mealNameInput}
              onChangeText={setMealNameInput}
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 5 }]}
                placeholder="カロリー(kcal)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={caloriesInput}
                onChangeText={setCaloriesInput}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 5 }]}
                placeholder="タンパク質(g)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={proteinInput}
                onChangeText={setProteinInput}
              />
            </View>
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 5 }]}
                placeholder="脂質(g)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={fatInput}
                onChangeText={setFatInput}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 5 }]}
                placeholder="炭水化物(g)"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={carbsInput}
                onChangeText={setCarbsInput}
              />
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
                onPress={handleAddManualMeal}
              >
                <Text style={styles.modalBtnText}>追加保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* チャット記録モーダル */}
      <Modal visible={isChatModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💬 チャット栄養AI記録</Text>
            <Text style={styles.modalSub}>食べたものを入力するとAIが栄養価を推計します</Text>
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
            <Text style={styles.modalTitle}>⚙️ アプリ設定 & 目標設定</Text>
            <Text style={styles.inputLabel}>目標カロリー (kcal)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(userGoals.calories)}
              onChangeText={(text) => setUserGoals({ ...userGoals, calories: Number(text) || 0 })}
            />
            <Text style={styles.inputLabel}>Gemini API Key</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="API Keyを入力..."
              placeholderTextColor="#94a3b8"
              value={apiKeys.geminiKey}
              onChangeText={(text) => setApiKeys({ ...apiKeys, geminiKey: text })}
            />
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
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 12
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
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
