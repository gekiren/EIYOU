import React, { useState } from 'react';
import { X, Save, Sun, Utensils, Moon, Coffee } from 'lucide-react';

export default function EditMealModal({ mealLog, onClose, onSave }) {
  const [mealType, setMealType] = useState(mealLog.mealType || 'lunch');
  const [name, setName] = useState(mealLog.name || '');
  const [calories, setCalories] = useState(mealLog.calories ?? 0);
  const [protein, setProtein] = useState(mealLog.protein ?? 0);
  const [fat, setFat] = useState(mealLog.fat ?? 0);
  const [carbs, setCarbs] = useState(mealLog.carbs ?? 0);
  const [sodium, setSodium] = useState(mealLog.sodium ?? 0);
  const [fiber, setFiber] = useState(mealLog.fiber ?? 0);
  const [memo, setMemo] = useState(mealLog.memo || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave(mealLog.id, {
      mealType,
      name,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0,
      sodium: Number(sodium) || 0,
      fiber: Number(fiber) || 0,
      memo
    });
  };

  const mealTypes = [
    { type: 'breakfast', label: '朝食', icon: <Sun size={16} color="#f59e0b" /> },
    { type: 'lunch', label: '昼食', icon: <Utensils size={16} color="#10b981" /> },
    { type: 'dinner', label: '夕食', icon: <Moon size={16} color="#3b82f6" /> },
    { type: 'snack', label: '間食', icon: <Coffee size={16} color="#ec4899" /> }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>✏️ 食事ログの編集</span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* フォームボディ */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          
          {/* 食事区分選択 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">食事区分</label>
            <div className="grid grid-cols-4 gap-2">
              {mealTypes.map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setMealType(item.type)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all ${
                    mealType === item.type
                      ? 'border-blue-500 bg-blue-500/10 text-white shadow-md shadow-blue-500/10'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 食品・料理名 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">食品・料理名</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 鮭おにぎりと味噌汁"
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* カロリー & PFCバランス & 塩分相当量 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">カロリー (kcal)</label>
              <input
                type="number"
                step="any"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">タンパク質 P (g)</label>
              <input
                type="number"
                step="any"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">脂質 F (g)</label>
              <input
                type="number"
                step="any"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">炭水化物 C (g)</label>
              <input
                type="number"
                step="any"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">食塩相当量 (g)</label>
              <input
                type="number"
                step="any"
                value={sodium}
                onChange={(e) => setSodium(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">食物繊維 (g)</label>
              <input
                type="number"
                step="any"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">メモ (任意)</label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="メモを入力..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
            >
              <Save size={16} />
              <span>変更を保存</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
