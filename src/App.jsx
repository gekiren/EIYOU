import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import MealLogList from './components/MealLogList.jsx';
import PhotoRecordModal from './components/PhotoRecordModal.jsx';
import ChatRecordModal from './components/ChatRecordModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import EditMealModal from './components/EditMealModal.jsx';
import { nutritionDb } from './shared_modules/db/nutritionDb.js';
import { safeStorage } from './shared_modules/storage/safeStorage.js';

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mealLogs, setMealLogs] = useState([]);

  // モーダル開閉ステート
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  // APIキー
  const [apiKeys, setApiKeys] = useState({
    geminiKey: safeStorage.getItemSync('eiyou_gemini_key', ''),
    deepSeekKey: safeStorage.getItemSync('eiyou_deepseek_key', ''),
    workerUrl: safeStorage.getItemSync('eiyou_worker_url', '')
  });

  // 日別目標値
  const [userGoals, setUserGoals] = useState(() => {
    const saved = safeStorage.getItemSync('eiyou_user_goals', '');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { calories: 2200, protein: 75, fat: 60, carbs: 280, sodium: 7.0 };
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

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch (e) {}
  };

  // 食事削除処理
  const handleDeleteMeal = async (id) => {
    if (window.confirm('この食事記録を削除しますか？')) {
      await nutritionDb.deleteMealLog(id);
      await loadMealLogs();
    }
  };

  // 食事更新処理
  const handleUpdateMeal = async (id, updateData) => {
    await nutritionDb.updateMealLog(id, updateData);
    setEditingMeal(null);
    await loadMealLogs();
  };

  // 設定の更新保存
  const handleSaveSettings = (newKeys, newGoals) => {
    setApiKeys(newKeys);
    setUserGoals(newGoals);

    safeStorage.setItem('eiyou_gemini_key', newKeys.geminiKey);
    safeStorage.setItem('eiyou_deepseek_key', newKeys.deepSeekKey);
    safeStorage.setItem('eiyou_worker_url', newKeys.workerUrl);
    safeStorage.setItem('eiyou_user_goals', JSON.stringify(newGoals));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <Header
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        <Dashboard
          mealLogs={mealLogs}
          userGoals={userGoals}
          selectedDate={selectedDate}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setIsPhotoModalOpen(true)}
            className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="text-2xl">📷</span>
            <span>写真 / OCRで記録</span>
          </button>

          <button
            onClick={() => setIsChatModalOpen(true)}
            className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="text-2xl">💬</span>
            <span>チャットで栄養記録</span>
          </button>
        </div>

        <MealLogList
          mealLogs={mealLogs}
          onDeleteMeal={handleDeleteMeal}
          onEditMeal={(log) => setEditingMeal(log)}
        />
      </main>

      {isPhotoModalOpen && (
        <PhotoRecordModal
          selectedDate={selectedDate}
          apiKeys={apiKeys}
          onClose={() => setIsPhotoModalOpen(false)}
          onSave={handleSaveMeal}
        />
      )}

      {isChatModalOpen && (
        <ChatRecordModal
          selectedDate={selectedDate}
          apiKeys={apiKeys}
          onClose={() => setIsChatModalOpen(false)}
          onSave={handleSaveMeal}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          apiKeys={apiKeys}
          userGoals={userGoals}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={handleSaveSettings}
        />
      )}

      {editingMeal && (
        <EditMealModal
          mealLog={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={handleUpdateMeal}
        />
      )}
    </div>
  );
}
