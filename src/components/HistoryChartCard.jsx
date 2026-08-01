import React, { useState, useMemo } from 'react';

const NUTRIENT_CONFIG = {
  calories: { label: 'カロリー', unit: 'kcal', color: '#10b981', overflowColor: '#ef4444' },
  protein: { label: 'タンパク質', unit: 'g', color: '#06b6d4', overflowColor: '#3b82f6' },
  fat: { label: '脂質', unit: 'g', color: '#f59e0b', overflowColor: '#ea580c' },
  carbs: { label: '炭水化物', unit: 'g', color: '#a855f7', overflowColor: '#6b21a8' },
  sodium: { label: '塩分', unit: 'g', color: '#f43f5e', overflowColor: '#be123c' },
};

const PERIOD_OPTIONS = [
  { label: '7日間', value: 7 },
  { label: '14日間', value: 14 },
  { label: '30日間', value: 30 },
];

export default function HistoryChartCard({ allLogs = [], userGoals = {} }) {
  const [selectedNutrient, setSelectedNutrient] = useState('calories');
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [activeBarIndex, setActiveBarIndex] = useState(null);

  const nutrientInfo = NUTRIENT_CONFIG[selectedNutrient] || NUTRIENT_CONFIG.calories;
  const targetVal = Number(userGoals[selectedNutrient]) || (selectedNutrient === 'calories' ? 2200 : 75);

  const chartData = useMemo(() => {
    const today = new Date();
    const dates = [];
    for (let i = selectedPeriod - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
      dates.push({ dateStr, label: monthDay, dayOfWeek, value: 0 });
    }

    const dateMap = new Map(dates.map(item => [item.dateStr, item]));
    allLogs.forEach(log => {
      if (log.date && dateMap.has(log.date)) {
        const item = dateMap.get(log.date);
        item.value += Number(log[selectedNutrient]) || 0;
      }
    });

    return dates;
  }, [allLogs, selectedNutrient, selectedPeriod]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { avg: 0, achievedDays: 0 };
    const total = chartData.reduce((acc, cur) => acc + cur.value, 0);
    const avg = total / chartData.length;
    let achievedDays = 0;
    chartData.forEach(d => {
      if (d.value > 0) {
        if (selectedNutrient === 'sodium' || selectedNutrient === 'calories') {
          if (d.value <= targetVal) achievedDays++;
        } else {
          if (d.value >= targetVal * 0.85) achievedDays++;
        }
      }
    });
    return {
      avg: Math.round(avg * 10) / 10,
      achievedDays
    };
  }, [chartData, targetVal, selectedNutrient]);

  const maxDataVal = Math.max(...chartData.map(d => d.value), 0);
  const maxScale = Math.max(maxDataVal, targetVal) * 1.15 || 100;
  const targetLinePercent = Math.min(100, Math.max(0, (targetVal / maxScale) * 100));

  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      {/* ヘッダー ＆ 期間タブ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            栄養摂取推移グラフ
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            目標: {targetVal} {nutrientInfo.unit}
          </span>
        </div>
        <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '8px' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setSelectedPeriod(opt.value); setActiveBarIndex(null); }}
              style={{
                border: 'none',
                background: selectedPeriod === opt.value ? '#334155' : 'transparent',
                color: selectedPeriod === opt.value ? '#38bdf8' : '#64748b',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 栄養素切り替え */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
        {Object.entries(NUTRIENT_CONFIG).map(([key, info]) => {
          const isActive = selectedNutrient === key;
          return (
            <button
              key={key}
              onClick={() => { setSelectedNutrient(key); setActiveBarIndex(null); }}
              style={{
                border: isActive ? 'none' : '1px solid #334155',
                background: isActive ? info.color : 'rgba(15, 23, 42, 0.5)',
                color: isActive ? '#ffffff' : '#94a3b8',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {info.label}
            </button>
          );
        })}
      </div>

      {/* サマリー */}
      <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '10px', padding: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>期間平均</div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>
            {stats.avg.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{nutrientInfo.unit}</span>
          </div>
        </div>
        <div style={{ width: '1px', background: '#334155' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>目標達成度</div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>
            {stats.achievedDays} / {selectedPeriod} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>日適正</span>
          </div>
        </div>
      </div>

      {/* ツールチップ */}
      {activeBarIndex !== null && chartData[activeBarIndex] && (
        <div style={{ background: '#334155', padding: '8px', borderRadius: '8px', marginBottom: '8px', textAlign: 'center', fontSize: '0.85rem' }}>
          {chartData[activeBarIndex].dateStr} ({chartData[activeBarIndex].dayOfWeek}):{' '}
          <strong style={{ color: nutrientInfo.color }}>
            {Math.round(chartData[activeBarIndex].value * 10) / 10} {nutrientInfo.unit}
          </strong>{' '}
          ({Math.round((chartData[activeBarIndex].value / targetVal) * 100)}%)
        </div>
      )}

      {/* グラフ領域 */}
      <div style={{ height: '180px', position: 'relative', marginTop: '10px', paddingTop: '16px' }}>
        {/* 目標線 */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `${targetLinePercent}%`,
          borderBottom: '1px dashed #f59e0b',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 5
        }}>
          <span style={{ fontSize: '0.65rem', color: '#f59e0b', background: '#1e293b', padding: '0 4px', fontWeight: 700 }}>
            目標 {targetVal}
          </span>
        </div>

        {/* バー一覧 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '24px', justifyContent: 'space-between' }}>
          {chartData.map((item, index) => {
            const barHeightPercent = Math.min(100, (item.value / maxScale) * 100);
            const isOverflow = item.value > targetVal && (selectedNutrient === 'calories' || selectedNutrient === 'sodium');
            const barColor = isOverflow ? nutrientInfo.overflowColor : nutrientInfo.color;
            const isSelected = activeBarIndex === index;

            return (
              <div
                key={item.dateStr}
                onClick={() => setActiveBarIndex(isSelected ? null : index)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  cursor: 'pointer',
                  margin: '0 2px'
                }}
              >
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  {item.value > 0 && (
                    <div style={{
                      width: '70%',
                      maxWidth: '20px',
                      height: `${Math.max(barHeightPercent, 3)}%`,
                      backgroundColor: barColor,
                      borderRadius: '4px 4px 0 0',
                      opacity: isSelected ? 1 : 0.85,
                      border: isSelected ? '2px solid #fff' : 'none',
                      transition: 'all 0.2s ease'
                    }} />
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: isSelected ? '#38bdf8' : '#94a3b8', marginTop: '4px', fontWeight: isSelected ? 700 : 500 }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '0.55rem', color: '#64748b' }}>
                  ({item.dayOfWeek})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
