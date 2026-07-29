import React, { useState } from 'react';
import { X, Target, Download, Upload, Save } from 'lucide-react';
import { exportMealsToCSV, importMealsFromCSV } from '../shared_modules/csv/nutritionCsvService';

export default function SettingsModal({
  isOpen,
  onClose,
  userGoals,
  onSaveUserGoals,
  onRefreshData
}) {
  if (!isOpen) return null;

  const [caloriesGoal, setCaloriesGoal] = useState(userGoals.calories || 2200);
  const [proteinGoal, setProteinGoal] = useState(userGoals.protein || 75);
  const [fatGoal, setFatGoal] = useState(userGoals.fat || 60);
  const [carbsGoal, setCarbsGoal] = useState(userGoals.carbs || 280);
  const [sodiumGoal, setSodiumGoal] = useState(userGoals.sodium || 7.0);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleSaveAll = () => {
    onSaveUserGoals({
      calories: Number(caloriesGoal),
      protein: Number(proteinGoal),
      fat: Number(fatGoal),
      carbs: Number(carbsGoal),
      sodium: Number(sodiumGoal)
    });

    setSaveSuccessMsg('目標設定を保存しました');
    setTimeout(() => {
      setSaveSuccessMsg('');
      onClose();
    }, 1000);
  };

  const handleExportCSV = async () => {
    try {
      await exportMealsToCSV();
    } catch (err) {
      alert('CSVエクスポートに失敗しました: ' + err.message);
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const count = await importMealsFromCSV(file);
        alert(`${count}件の食事ログをCSVから復元・インポートしました。`);
        onRefreshData();
      } catch (err) {
        alert('CSVインポートエラー: ' + err.message);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        position: 'relative'
      }}>
        <button onClick={onClose} className="btn-secondary" style={{ position: 'absolute', top: '20px', right: '20px', padding: '8px' }}>
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>設定 & 目標管理</h2>

        {/* 目標設定 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--color-secondary)' }}>
            <Target size={18} />
            <span>日別栄養目標の設定</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>目標カロリー (kcal)</label>
              <input
                type="number"
                value={caloriesGoal}
                onChange={(e) => setCaloriesGoal(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>目標タンパク質 (g)</label>
              <input
                type="number"
                value={proteinGoal}
                onChange={(e) => setProteinGoal(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>目標脂質 (g)</label>
              <input
                type="number"
                value={fatGoal}
                onChange={(e) => setFatGoal(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>目標炭水化物 (g)</label>
              <input
                type="number"
                value={carbsGoal}
                onChange={(e) => setCarbsGoal(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* CSVインポート/エクスポート */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Download size={18} />
            <span>データの入出力 (CSV)</span>
          </h3>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleExportCSV} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              <Download size={16} />
              <span>CSVでログ出力</span>
            </button>

            <label className="btn-secondary" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer' }}>
              <Upload size={16} />
              <span>CSVから復元</span>
              <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* 保存アクション */}
        <div>
          {saveSuccessMsg && (
            <p style={{ color: '#10b981', textAlign: 'center', fontWeight: 600, marginBottom: '10px' }}>{saveSuccessMsg}</p>
          )}

          <button onClick={handleSaveAll} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
            <Save size={18} />
            <span>設定を保存</span>
          </button>
        </div>

      </div>
    </div>
  );
}
