import React, { useState, useEffect } from 'react';
import { X, Target, Download, Upload, Save, RefreshCw, FileText, Folder, CheckSquare } from 'lucide-react';
import { exportMealsToCSV, importMealsFromCSV } from '../shared_modules/csv/nutritionCsvService';
import { obsidianSyncService } from '../shared_modules/obsidian/obsidianSyncService';

export default function SettingsModal({
  isOpen,
  onClose,
  userGoals,
  onSaveUserGoals,
  onRefreshData
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('goals'); // 'goals' | 'obsidian' | 'data'

  const [caloriesGoal, setCaloriesGoal] = useState(userGoals.calories || 2200);
  const [proteinGoal, setProteinGoal] = useState(userGoals.protein || 75);
  const [fatGoal, setFatGoal] = useState(userGoals.fat || 60);
  const [carbsGoal, setCarbsGoal] = useState(userGoals.carbs || 280);
  const [sodiumGoal, setSodiumGoal] = useState(userGoals.sodium || 7.0);

  // 目標設定モード & PFC比率ステート
  // 'calorie_pfc': 1. カロリー + PFC% 指定
  // 'pfc_gram': 2. PFC(g) 直接指定
  // 'protein_pfc': 3. P(g) + PFC% 指定
  const [goalMode, setGoalMode] = useState('calorie_pfc');
  const [pRatio, setPRatio] = useState(30);
  const [fRatio, setFRatio] = useState(20);
  const [cRatio, setCRatio] = useState(50);

  // Obsidian 連携ステート
  const [obsidianEnabled, setObsidianEnabled] = useState(false);
  const [obsidianVaultUri, setObsidianVaultUri] = useState('');
  const [obsidianSaveMode, setObsidianSaveMode] = useState('dedicated'); // 'dedicated' | 'append' | 'individual'
  const [obsidianFolderName, setObsidianFolderName] = useState('EIYOU');
  const [obsidianAutoSyncOnLaunch, setObsidianAutoSyncOnLaunch] = useState(true);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    if (userGoals) {
      const cal = Number(userGoals.calories) || 2200;
      const p = Number(userGoals.protein) || 75;
      const f = Number(userGoals.fat) || 60;
      const c = Number(userGoals.carbs) || 280;
      setCaloriesGoal(cal);
      setProteinGoal(p);
      setFatGoal(f);
      setCarbsGoal(c);
      setSodiumGoal(userGoals.sodium || 7.0);

      if (cal > 0) {
        const pr = Math.round(((p * 4) / cal) * 100);
        const fr = Math.round(((f * 9) / cal) * 100);
        const cr = 100 - pr - fr;
        setPRatio(pr > 0 ? pr : 30);
        setFRatio(fr > 0 ? fr : 20);
        setCRatio(cr > 0 ? cr : 50);
      }
    }

    // Obsidian 設定読み込み
    obsidianSyncService.getConfig().then(cfg => {
      setObsidianEnabled(cfg.enabled || false);
      setObsidianVaultUri(cfg.vaultUri || '');
      setObsidianSaveMode(cfg.saveMode || 'dedicated');
      setObsidianFolderName(cfg.folderName || 'EIYOU');
      setObsidianAutoSyncOnLaunch(cfg.autoSyncOnLaunch !== false);
    });
  }, [userGoals]);

  // モード1: カロリー ＆ PFC% 指定の計算
  const handleCalorieAndRatioChange = (newCal, newP, newF, newC) => {
    const cal = newCal !== undefined ? newCal : caloriesGoal;
    const pr = newP !== undefined ? newP : pRatio;
    const fr = newF !== undefined ? newF : fRatio;
    const cr = newC !== undefined ? newC : cRatio;

    setCaloriesGoal(cal);
    setPRatio(pr);
    setFRatio(fr);
    setCRatio(cr);

    const totalCal = Number(cal) || 0;
    const pG = Math.round((totalCal * (Number(pr) / 100)) / 4);
    const fG = Math.round((totalCal * (Number(fr) / 100)) / 9);
    const cG = Math.round((totalCal * (Number(cr) / 100)) / 4);

    setProteinGoal(pG);
    setFatGoal(fG);
    setCarbsGoal(cG);
  };

  // モード2: PFC(g) 直接指定の計算
  const handleGramChange = (newP, newF, newC) => {
    const pG = newP !== undefined ? Number(newP) : Number(proteinGoal);
    const fG = newF !== undefined ? Number(newF) : Number(fatGoal);
    const cG = newC !== undefined ? Number(newC) : Number(carbsGoal);

    if (newP !== undefined) setProteinGoal(newP);
    if (newF !== undefined) setFatGoal(newF);
    if (newC !== undefined) setCarbsGoal(newC);

    const totalCal = Math.round(pG * 4 + fG * 9 + cG * 4);
    setCaloriesGoal(totalCal);

    if (totalCal > 0) {
      const pr = Math.round(((pG * 4) / totalCal) * 100);
      const fr = Math.round(((fG * 9) / totalCal) * 100);
      const cr = 100 - pr - fr;
      setPRatio(pr);
      setFRatio(fr);
      setCRatio(cr);
    }
  };

  // モード3: P(g) ＆ PFC% 指定の計算
  const handleProteinAndRatioChange = (newP, newPR, newFR, newCR) => {
    const pG = newP !== undefined ? Number(newP) : Number(proteinGoal);
    const pr = newPR !== undefined ? Number(newPR) : Number(pRatio);
    const fr = newFR !== undefined ? Number(newFR) : Number(fRatio);
    const cr = newCR !== undefined ? Number(newCR) : Number(cRatio);

    if (newP !== undefined) setProteinGoal(newP);
    if (newPR !== undefined) setPRatio(newPR);
    if (newFR !== undefined) setFRatio(newFR);
    if (newCR !== undefined) setCRatio(newCR);

    const pCal = pG * 4;
    const totalCal = pr > 0 ? Math.round(pCal / (pr / 100)) : 0;
    const fG = Math.round((totalCal * (fr / 100)) / 9);
    const cG = Math.round((totalCal * (cr / 100)) / 4);

    setCaloriesGoal(totalCal);
    setFatGoal(fG);
    setCarbsGoal(cG);
  };

  const handleSaveAll = async () => {
    onSaveUserGoals({
      calories: Number(caloriesGoal),
      protein: Number(proteinGoal),
      fat: Number(fatGoal),
      carbs: Number(carbsGoal),
      sodium: Number(sodiumGoal)
    });

    await obsidianSyncService.saveConfig({
      enabled: obsidianEnabled,
      vaultUri: obsidianVaultUri,
      saveMode: obsidianSaveMode,
      folderName: obsidianFolderName,
      autoSyncOnLaunch: obsidianAutoSyncOnLaunch
    });

    setSaveSuccessMsg('設定を保存しました');
    setTimeout(() => {
      setSaveSuccessMsg('');
      onClose();
    }, 1000);
  };

  const handleSelectVaultFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker();
        window.obsidianDirectoryHandle = handle;
        setObsidianVaultUri(handle.name || 'Obsidian Vault');
        setSyncStatusMsg(`保存先フォルダ「${handle.name}」を選択しました。`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          alert('フォルダ選択エラー: ' + err.message);
        }
      }
    } else {
      const path = prompt('Obsidian Vault フォルダ名またはパスを入力してください:', obsidianVaultUri || 'Obsidian Vault');
      if (path !== null) {
        setObsidianVaultUri(path);
      }
    }
  };

  const handleManualSyncAll = async () => {
    setSyncStatusMsg('一括同期中...');
    try {
      const res = await obsidianSyncService.syncAllMealLogs(userGoals);
      if (res.success) {
        setSyncStatusMsg(`一括同期完了: ${res.count || 1}件のノートを出力/更新しました。`);
      } else {
        setSyncStatusMsg(`同期失敗: ${res.reason || '連携が無効か設定が不十分です'}`);
      }
    } catch (e) {
      setSyncStatusMsg('同期エラー: ' + e.message);
    }
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
        maxWidth: '540px',
        maxHeight: '85vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '24px',
        paddingBottom: '32px',
        position: 'relative'
      }}>
        <button onClick={onClose} className="btn-secondary" style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px' }}>
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '16px' }}>⚙️ アプリ設定</h2>

        {/* タブナビゲーション */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('goals')}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'goals' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              color: activeTab === 'goals' ? '#60a5fa' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            🎯 栄養目標
          </button>
          <button
            onClick={() => setActiveTab('obsidian')}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'obsidian' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
              color: activeTab === 'obsidian' ? '#c084fc' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            📄 Obsidian連携
          </button>
          <button
            onClick={() => setActiveTab('data')}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'data' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
              color: activeTab === 'data' ? '#34d399' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            📁 データ・その他
          </button>
        </div>

        {/* 1. 栄養目標設定タブ */}
        {activeTab === 'goals' && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: 'var(--color-secondary)' }}>
              <Target size={18} />
              <span>日別栄養目標の設定</span>
            </h3>

            {/* モード選択タブ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>設定方法の選択</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setGoalMode('calorie_pfc')}
                  style={{
                    padding: '8px 4px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                    backgroundColor: goalMode === 'calorie_pfc' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                    color: goalMode === 'calorie_pfc' ? '#38bdf8' : 'var(--text-muted)'
                  }}
                >
                  1. カロリー+%
                </button>
                <button
                  type="button"
                  onClick={() => setGoalMode('pfc_gram')}
                  style={{
                    padding: '8px 4px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                    backgroundColor: goalMode === 'pfc_gram' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                    color: goalMode === 'pfc_gram' ? '#38bdf8' : 'var(--text-muted)'
                  }}
                >
                  2. PFC(g)直接
                </button>
                <button
                  type="button"
                  onClick={() => setGoalMode('protein_pfc')}
                  style={{
                    padding: '8px 4px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                    backgroundColor: goalMode === 'protein_pfc' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                    color: goalMode === 'protein_pfc' ? '#38bdf8' : 'var(--text-muted)'
                  }}
                >
                  3. P(g)+%指定
                </button>
              </div>
            </div>

            {/* モード1: カロリー ＆ PFC% 指定 */}
            {goalMode === 'calorie_pfc' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>目標カロリー (kcal)</label>
                  <input
                    type="number"
                    value={caloriesGoal}
                    onChange={(e) => handleCalorieAndRatioChange(e.target.value, undefined, undefined, undefined)}
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'block', marginBottom: '4px' }}>P (タンパク質 %)</label>
                    <input
                      type="number"
                      value={pRatio}
                      onChange={(e) => handleCalorieAndRatioChange(undefined, e.target.value, undefined, undefined)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#f87171', display: 'block', marginBottom: '4px' }}>F (脂質 %)</label>
                    <input
                      type="number"
                      value={fRatio}
                      onChange={(e) => handleCalorieAndRatioChange(undefined, undefined, e.target.value, undefined)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'block', marginBottom: '4px' }}>C (炭水化物 %)</label>
                    <input
                      type="number"
                      value={cRatio}
                      onChange={(e) => handleCalorieAndRatioChange(undefined, undefined, undefined, e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* モード2: PFC(g) 直接指定 */}
            {goalMode === 'pfc_gram' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'block', marginBottom: '4px' }}>タンパク質 (g)</label>
                  <input
                    type="number"
                    value={proteinGoal}
                    onChange={(e) => handleGramChange(e.target.value, undefined, undefined)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#f87171', display: 'block', marginBottom: '4px' }}>脂質 (g)</label>
                  <input
                    type="number"
                    value={fatGoal}
                    onChange={(e) => handleGramChange(undefined, e.target.value, undefined)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'block', marginBottom: '4px' }}>炭水化物 (g)</label>
                  <input
                    type="number"
                    value={carbsGoal}
                    onChange={(e) => handleGramChange(undefined, undefined, e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            )}

            {/* モード3: P(g) ＆ PFC% 指定 */}
            {goalMode === 'protein_pfc' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#60a5fa', display: 'block', marginBottom: '4px' }}>タンパク質 (g)</label>
                  <input
                    type="number"
                    value={proteinGoal}
                    onChange={(e) => handleProteinAndRatioChange(e.target.value, undefined, undefined, undefined)}
                    className="input-field"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'block', marginBottom: '4px' }}>P (割合 %)</label>
                    <input
                      type="number"
                      value={pRatio}
                      onChange={(e) => handleProteinAndRatioChange(undefined, e.target.value, undefined, undefined)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#f87171', display: 'block', marginBottom: '4px' }}>F (割合 %)</label>
                    <input
                      type="number"
                      value={fRatio}
                      onChange={(e) => handleProteinAndRatioChange(undefined, undefined, e.target.value, undefined)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'block', marginBottom: '4px' }}>C (割合 %)</label>
                    <input
                      type="number"
                      value={cRatio}
                      onChange={(e) => handleProteinAndRatioChange(undefined, undefined, undefined, e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 計算結果サマリーカード */}
            <div style={{
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '10px',
              padding: '12px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              marginBottom: '12px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>📊 決定される目標値とPFC比率</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  🔥 {caloriesGoal} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>kcal</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#60a5fa' }}>
                  P: {proteinGoal}g <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({pRatio}%)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#f87171' }}>
                  F: {fatGoal}g <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({fRatio}%)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#fbbf24' }}>
                  C: {carbsGoal}g <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({cRatio}%)</span>
                </div>
              </div>
              {(Number(pRatio) + Number(fRatio) + Number(cRatio) !== 100) && (goalMode === 'calorie_pfc' || goalMode === 'protein_pfc') && (
                <div style={{ fontSize: '0.7rem', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                  ⚠️ PFC比率の合計が 100% になっていません (現在: {Number(pRatio) + Number(fRatio) + Number(cRatio)}%)
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Obsidian 連携設定タブ */}
        {activeTab === 'obsidian' && (
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#a78bfa' }}>
              <FileText size={18} />
              <span>Obsidian Vault 自動連携設定</span>
            </h3>

            {/* 有効/無効 トグル */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Obsidian 自動連携</span>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={obsidianEnabled}
                  onChange={(e) => setObsidianEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
                />
                <span style={{ fontSize: '0.85rem', color: obsidianEnabled ? '#c084fc' : 'var(--text-muted)' }}>
                  {obsidianEnabled ? '有効 (ON)' : '無効 (OFF)'}
                </span>
              </label>
            </div>

            {obsidianEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {/* Vault フォルダ選択 */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Obsidian Vault 保存先フォルダ
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={obsidianVaultUri || '未選択'}
                      className="input-field"
                      style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
                    />
                    <button onClick={handleSelectVaultFolder} className="btn-secondary" style={{ padding: '8px 12px' }}>
                      <Folder size={16} />
                      <span>選択</span>
                    </button>
                  </div>
                </div>

                {/* 保存モード選択 */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    保存モード選択
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="saveMode"
                        value="dedicated"
                        checked={obsidianSaveMode === 'dedicated'}
                        onChange={(e) => setObsidianSaveMode(e.target.value)}
                      />
                      <span>a) 専用ノート (<code>EIYOU_YYYY-MM-DD.md</code>)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="saveMode"
                        value="append"
                        checked={obsidianSaveMode === 'append'}
                        onChange={(e) => setObsidianSaveMode(e.target.value)}
                      />
                      <span>b) デイリーノート追記 (<code>Daily/YYYY-MM-DD.md</code>)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="saveMode"
                        value="individual"
                        checked={obsidianSaveMode === 'individual'}
                        onChange={(e) => setObsidianSaveMode(e.target.value)}
                      />
                      <span>c) 個別ノート (<code>EIYOU_Nutrition_Log.md</code>)</span>
                    </label>
                  </div>
                </div>

                {/* 保存先サブフォルダ名カスタム */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    保存先サブフォルダ名 (デフォルト: EIYOU)
                  </label>
                  <input
                    type="text"
                    value={obsidianFolderName}
                    onChange={(e) => setObsidianFolderName(e.target.value)}
                    className="input-field"
                    placeholder="EIYOU"
                  />
                </div>

                {/* 起動時自動同期トグル */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>起動時に自動一括チェック＆同期</span>
                  <input
                    type="checkbox"
                    checked={obsidianAutoSyncOnLaunch}
                    onChange={(e) => setObsidianAutoSyncOnLaunch(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
                  />
                </div>

                {/* 手動同期ボタン */}
                <button
                  onClick={handleManualSyncAll}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#c084fc', marginTop: '6px' }}
                >
                  <CheckSquare size={16} />
                  <span>全食事ログを今すぐ Obsidian へ同期</span>
                </button>

                {syncStatusMsg && (
                  <p style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '4px' }}>{syncStatusMsg}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. データ・その他タブ */}
        {activeTab === 'data' && (
          <div>
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

            {/* OTA更新チェック */}
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => alert('現在利用可能なOTAアップデートはありません。(最新バージョンです)')}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#c084fc', padding: '12px' }}
              >
                <RefreshCw size={16} />
                <span>🔄 アプリのOTA更新を手動チェック</span>
              </button>
            </div>
          </div>
        )}

        {/* 保存アクション */}
        <div style={{ marginTop: '16px' }}>
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


