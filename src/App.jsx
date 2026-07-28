import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import MealLogList from './components/MealLogList.jsx';
import PhotoRecordModal from './components/PhotoRecordModal.jsx';
import ChatRecordModal from './components/ChatRecordModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { nutritionDb } from './shared_modules/db/nutritionDb.js';

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealLogs, setMealLogs] = useState([]);
  
  // モーダル開閉ステート
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // APIキー (LocalStorage 保持)
  const [apiKeys, setApiKeys] = useState(() => ({
    geminiKey: localStorage.getItem('eiyou_gemini_key') || '',
    deepSeekKey: localStorage.getItem('eiyou_deepseek_key') || '',
    workerUrl: localStorage.getItem('eiyou_worker_url') || ''
  }));

  // 日別目標値 (LocalStorage / State 保持)
  const [userGoals, setUserGoals] = useState(() => {
    const saved = localStorage.getItem('eiyou_user_goals');
    return saved ? JSON.parse(saved) : {
      calories: 2200,
      protein: 75,
      fat: 60,
      carbs: 280,
      sodium: 7.0
    };
  });

  // 日付変更時のデータロード
  const loadMealLogs = async () => {
    try {
      const logs = await nutritionDb.getMealLogsByDate(selectedDate);
      setMealLogs(logs || []);
    } catch (err) {
      console.error('Error loading meal logs:', err);
    }
  };

  useEffect(() => {
    loadMealLogs();
  }, [selectedDate]);

  // 食事追加保存処理
  const handleSaveMeal = async (mealData) => {
    await nutritionDb.addMealLog(mealData);
    await loadMealLogs();

    // 紙吹雪アニメーション (目標到達時や新規記録の祝福)
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });
  };

  // 食事削除処理
  const handleDeleteMeal = async (id) => {
    if (window.confirm('この食事記録を削除しますか？')) {
      await nutritionDb.deleteMealLog(id);
      await loadMealLogs();
    }
  };

  // APIキー保存
  const handleSaveApiKeys = (keys) => {
    setApiKeys(keys);
    localStorage.setItem('eiyou_gemini_key', keys.geminiKey);
    localStorage.setItem('eiyou_deepseek_key', keys.deepSeekKey);
    localStorage.setItem('eiyou_worker_url', keys.workerUrl);
  };

  // 目標値保存
  const handleSaveUserGoals = (goals) => {
    setUserGoals(goals);
    localStorage.setItem('eiyou_user_goals', JSON.stringify(goals));
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px 16px 60px 16px' }}>
      
      {/* ヘッダー */}
      <Header
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenPhotoModal={() => setIsPhotoModalOpen(true)}
        onOpenChatModal={() => setIsChatModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      <main>
        {/* 本日の進捗ダッシュボード */}
        <Dashboard mealLogs={mealLogs} userGoals={userGoals} />

        {/* 本日の食事ログ一覧 */}
        <MealLogList mealLogs={mealLogs} onDeleteMeal={handleDeleteMeal} />
      </main>

      {/* 写真記録モーダル */}
      <PhotoRecordModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onSaveMeal={handleSaveMeal}
        apiKeys={apiKeys}
        selectedDate={selectedDate}
      />

      {/* チャット記録モーダル */}
      <ChatRecordModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        onSaveMeal={handleSaveMeal}
        apiKeys={apiKeys}
        selectedDate={selectedDate}
      />

      {/* 設定＆データ入出力モーダル */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        apiKeys={apiKeys}
        onSaveApiKeys={handleSaveApiKeys}
        userGoals={userGoals}
        onSaveUserGoals={handleSaveUserGoals}
        onRefreshData={loadMealLogs}
      />

    </div>
  );
}
