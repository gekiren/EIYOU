import React from 'react';
import { Flame, Activity, Zap, Shield, Sparkles } from 'lucide-react';

export default function Dashboard({ mealLogs, userGoals }) {
  // 合計計算
  const totals = mealLogs.reduce((acc, log) => {
    acc.calories += Number(log.calories) || 0;
    acc.protein += Number(log.protein) || 0;
    acc.fat += Number(log.fat) || 0;
    acc.carbs += Number(log.carbs) || 0;
    acc.sodium += Number(log.sodium) || 0;
    acc.fiber += Number(log.fiber) || 0;
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0, fiber: 0 });

  const goals = userGoals || {
    calories: 2200,
    protein: 75,
    fat: 60,
    carbs: 280,
    sodium: 7.0,
    fiber: 20.0
  };

  const calPercent = Math.min(100, Math.round((totals.calories / goals.calories) * 100));
  const pPercent = Math.min(100, Math.round((totals.protein / goals.protein) * 100));
  const fPercent = Math.min(100, Math.round((totals.fat / goals.fat) * 100));
  const cPercent = Math.min(100, Math.round((totals.carbs / goals.carbs) * 100));
  const fiberPercent = Math.min(100, Math.round((totals.fiber / (goals.fiber || 20)) * 100));

  // カロリーによるPFCのエネルギー構成比（P:4kcal, F:9kcal, C:4kcal）
  const pCal = totals.protein * 4;
  const fCal = totals.fat * 9;
  const cCal = totals.carbs * 4;
  const totalPfcCal = pCal + fCal + cCal || 1;

  const pRatio = Math.round((pCal / totalPfcCal) * 100);
  const fRatio = Math.round((fCal / totalPfcCal) * 100);
  const cRatio = Math.round((cCal / totalPfcCal) * 100);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
      
      {/* 総エネルギー (カロリー) メインカード */}
      <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={22} color="#10b981" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>本日摂取エネルギー</h2>
          </div>
          <span style={{ fontSize: '0.85rem', color: calPercent > 100 ? '#ef4444' : 'var(--text-muted)' }}>
            目標: {goals.calories} kcal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '2.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
            {totals.calories.toLocaleString()}
          </span>
          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>kcal</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.9rem', fontWeight: 700, color: calPercent >= 100 ? '#ef4444' : '#10b981' }}>
            {calPercent}%
          </span>
        </div>

        <div className="progress-bar-bg" style={{ height: '10px', marginBottom: '12px' }}>
          <div className="progress-bar-fill" style={{ width: `${calPercent}%`, background: calPercent > 100 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #10b981, #06b6d4)' }} />
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <span>塩分: {totals.sodium.toFixed(1)} / {goals.sodium}g</span>
          <span>食物繊維: {totals.fiber.toFixed(1)} / {goals.fiber || 20}g ({fiberPercent}%)</span>
        </div>
      </div>

      {/* PFCバランス 詳細カード */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="#06b6d4" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>PFC バランス</h2>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
            <span>P:{pRatio}%</span>
            <span>F:{fRatio}%</span>
            <span>C:{cRatio}%</span>
          </div>
        </div>

        {/* タンパク質 (Protein) */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--color-protein)', fontWeight: 600 }}>タンパク質 (P)</span>
            <span>{totals.protein.toFixed(1)} / {goals.protein}g ({pPercent}%)</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${pPercent}%`, background: 'var(--color-protein)' }} />
          </div>
        </div>

        {/* 脂質 (Fat) */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--color-fat)', fontWeight: 600 }}>脂質 (F)</span>
            <span>{totals.fat.toFixed(1)} / {goals.fat}g ({fPercent}%)</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${fPercent}%`, background: 'var(--color-fat)' }} />
          </div>
        </div>

        {/* 炭水化物 (Carbs) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--color-carbs)', fontWeight: 600 }}>炭水化物 (C)</span>
            <span>{totals.carbs.toFixed(1)} / {goals.carbs}g ({cPercent}%)</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${cPercent}%`, background: 'var(--color-carbs)' }} />
          </div>
        </div>

      </div>

    </div>
  );
}
