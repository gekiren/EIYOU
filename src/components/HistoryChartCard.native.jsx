import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView
} from 'react-native';

const NUTRIENT_CONFIG = {
  calories: { label: 'カロリー', unit: 'kcal', color: '#10b981', overflowColor: '#ef4444', underflowColor: '#3b82f6' },
  protein: { label: 'タンパク質', unit: 'g', color: '#06b6d4', overflowColor: '#3b82f6', underflowColor: '#64748b' },
  fat: { label: '脂質', unit: 'g', color: '#f59e0b', overflowColor: '#ea580c', underflowColor: '#64748b' },
  carbs: { label: '炭水化物', unit: 'g', color: '#a855f7', overflowColor: '#6b21a8', underflowColor: '#64748b' },
  sodium: { label: '塩分', unit: 'g', color: '#f43f5e', overflowColor: '#be123c', underflowColor: '#10b981' },
};

const DEFAULT_TOLERANCES = {
  calories: { min: -10, max: 5 },   // -10% 〜 +5%
  protein: { min: -15, max: 20 },   // -15% 〜 +20%
  fat: { min: -15, max: 15 },       // -15% 〜 +15%
  carbs: { min: -15, max: 15 },     // -15% 〜 +15%
  sodium: { min: -100, max: 0 },    // 〜 +0% (目標以下)
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

  // ユーザー設定の許容範囲 (-% 〜 +%)
  const userTolerance = userGoals.tolerances?.[selectedNutrient] || DEFAULT_TOLERANCES[selectedNutrient] || { min: -10, max: 10 };
  const minPercent = Number(userTolerance.min) ?? -10;
  const maxPercent = Number(userTolerance.max) ?? 10;

  // 目標の適正（達成）数値範囲の計算
  const minTargetVal = Math.max(0, Math.round(targetVal * (1 + minPercent / 100) * 10) / 10);
  const maxTargetVal = Math.round(targetVal * (1 + maxPercent / 100) * 10) / 10;

  // 直近N日間のデータ集計
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

  // 統計情報（平均値・達成日数）
  const stats = useMemo(() => {
    if (chartData.length === 0) return { avg: 0, achievedDays: 0 };
    const total = chartData.reduce((acc, cur) => acc + cur.value, 0);
    const avg = total / chartData.length;

    let achievedDays = 0;
    chartData.forEach(d => {
      if (d.value > 0 && d.value >= minTargetVal && d.value <= maxTargetVal) {
        achievedDays++;
      }
    });

    return {
      avg: Math.round(avg * 10) / 10,
      achievedDays
    };
  }, [chartData, minTargetVal, maxTargetVal]);

  // Y軸の最大スケール値計算
  const maxDataVal = Math.max(...chartData.map(d => d.value), 0);
  const maxScale = Math.max(maxDataVal, maxTargetVal, targetVal) * 1.15 || 100;

  // 目標線・達成帯の高さ割合 (%)
  const targetLinePercent = Math.min(100, Math.max(0, (targetVal / maxScale) * 100));
  const minTargetPercent = Math.min(100, Math.max(0, (minTargetVal / maxScale) * 100));
  const maxTargetPercent = Math.min(100, Math.max(0, (maxTargetVal / maxScale) * 100));
  const zoneHeightPercent = Math.max(0, maxTargetPercent - minTargetPercent);

  // 目標からの許容範囲テキスト
  const toleranceText = `${minPercent >= 0 ? '+' : ''}${minPercent}% 〜 ${maxPercent >= 0 ? '+' : ''}${maxPercent}%`;

  return (
    <View style={styles.cardContainer}>
      {/* ヘッダータイトル & 期間タブ */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>栄養摂取推移</Text>
          <Text style={styles.cardSubtitle}>
            目標: {targetVal} {nutrientInfo.unit} ({toleranceText})
          </Text>
        </View>

        {/* 期間選択タブ */}
        <View style={styles.periodTabContainer}>
          {PERIOD_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.periodTab,
                selectedPeriod === opt.value && styles.activePeriodTab
              ]}
              onPress={() => {
                setSelectedPeriod(opt.value);
                setActiveBarIndex(null);
              }}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === opt.value && styles.activePeriodTabText
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 栄養素切り替えピルボタン */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nutrientSelector}
      >
        {Object.entries(NUTRIENT_CONFIG).map(([key, info]) => {
          const isActive = selectedNutrient === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.nutrientBtn,
                isActive && { backgroundColor: info.color }
              ]}
              onPress={() => {
                setSelectedNutrient(key);
                setActiveBarIndex(null);
              }}
            >
              <Text
                style={[
                  styles.nutrientBtnText,
                  isActive && styles.activeNutrientBtnText
                ]}
              >
                {info.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* サマリー情報（平均 ＆ 達成日数） */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>期間平均</Text>
          <Text style={styles.statValue}>
            {stats.avg.toLocaleString()} <Text style={styles.statUnit}>{nutrientInfo.unit}</Text>
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>目標達成度 ({stats.achievedDays}/{selectedPeriod}日)</Text>
          <Text style={styles.statRange}>
            適正: {minTargetVal} 〜 {maxTargetVal} {nutrientInfo.unit}
          </Text>
        </View>
      </View>

      {/* 選択バーのツールチップ表示 */}
      {activeBarIndex !== null && chartData[activeBarIndex] && (
        <View style={styles.tooltipContainer}>
          {(() => {
            const item = chartData[activeBarIndex];
            const isAchieved = item.value >= minTargetVal && item.value <= maxTargetVal;
            const statusLabel = isAchieved
              ? '🎯 達成（適正）'
              : item.value < minTargetVal
              ? '📉 不足'
              : '📈 超過';
            const statusColor = isAchieved ? '#10b981' : item.value < minTargetVal ? '#60a5fa' : '#ef4444';

            return (
              <Text style={styles.tooltipText}>
                {item.dateStr} ({item.dayOfWeek}):{' '}
                <Text style={{ fontWeight: 'bold', color: statusColor }}>
                  {Math.round(item.value * 10) / 10} {nutrientInfo.unit}
                </Text>
                {' '}
                ({Math.round((item.value / targetVal) * 100)}%) — <Text style={{ color: statusColor, fontWeight: '700' }}>{statusLabel}</Text>
              </Text>
            );
          })()}
        </View>
      )}

      {/* 棒グラフ領域 */}
      <View style={styles.chartAreaContainer}>
        {/* 達成適正帯 (グリーンゾーン) */}
        {zoneHeightPercent > 0 && (
          <View
            style={[
              styles.targetZone,
              {
                bottom: `${minTargetPercent}%`,
                height: `${zoneHeightPercent}%`,
              }
            ]}
          />
        )}

        {/* 目標ライン (中央基準線) */}
        <View style={[styles.targetLine, { bottom: `${targetLinePercent}%` }]}>
          <View style={styles.targetDashedLine} />
          <Text style={styles.targetLineLabel}>目標 {targetVal}</Text>
        </View>

        {/* バー一覧 */}
        <ScrollView
          horizontal={selectedPeriod > 7}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barsContainer}
        >
          {chartData.map((item, index) => {
            const barHeightPercent = Math.min(100, (item.value / maxScale) * 100);
            const isAchieved = item.value >= minTargetVal && item.value <= maxTargetVal;
            const isUnder = item.value < minTargetVal;

            let barColor = nutrientInfo.color;
            if (!isAchieved && item.value > 0) {
              barColor = isUnder ? nutrientInfo.underflowColor : nutrientInfo.overflowColor;
            }

            const isSelected = activeBarIndex === index;

            return (
              <TouchableOpacity
                key={item.dateStr}
                activeOpacity={0.8}
                style={styles.barColumn}
                onPress={() => setActiveBarIndex(isSelected ? null : index)}
              >
                {/* バー本体 */}
                <View style={styles.barTrack}>
                  {item.value > 0 && (
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(barHeightPercent, 3)}%`,
                          backgroundColor: barColor,
                          opacity: isSelected ? 1.0 : 0.85,
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: '#ffffff',
                        }
                      ]}
                    />
                  )}
                </View>

                {/* X軸日付ラベル */}
                <Text
                  style={[
                    styles.xAxisLabel,
                    isSelected && styles.activeXAxisLabel
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Text style={styles.xAxisSubLabel}>
                  ({item.dayOfWeek})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  periodTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 3,
  },
  periodTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  activePeriodTab: {
    backgroundColor: '#334155',
  },
  periodTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  activePeriodTabText: {
    color: '#38bdf8',
  },
  nutrientSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  nutrientBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  nutrientBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeNutrientBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  statRange: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  statUnit: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '400',
  },
  tooltipContainer: {
    backgroundColor: '#334155',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  tooltipText: {
    fontSize: 12,
    color: '#f8fafc',
  },
  chartAreaContainer: {
    height: 180,
    position: 'relative',
    marginTop: 8,
    paddingTop: 16,
  },
  targetZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderStyle: 'dashed',
    zIndex: 2,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  targetDashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
  },
  targetLineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    marginLeft: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingBottom: 24,
    justifyContent: 'space-between',
    minWidth: '100%',
    zIndex: 5,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    marginHorizontal: 2,
    minWidth: 28,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '70%',
    maxWidth: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  xAxisLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  activeXAxisLabel: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  xAxisSubLabel: {
    fontSize: 8,
    color: '#64748b',
  },
});
