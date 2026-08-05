import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { calculatePfcRatio } from '../utils/nutritionCalculator.js';

export default function NutritionSummaryCard({ totals = {}, userGoals = {}, mealLogs = [] }) {
  const goalCal = Number(userGoals.calories) || 2200;
  const goalP = Number(userGoals.protein) || 75;
  const goalF = Number(userGoals.fat) || 60;
  const goalC = Number(userGoals.carbs) || 280;
  const goalS = Number(userGoals.sodium) || 7.0;
  const goalFi = Number(userGoals.fiber) || 20.0;

  const cal = totals.calories || 0;
  const p = totals.protein || 0;
  const f = totals.fat || 0;
  const c = totals.carbs || 0;
  const s = totals.sodium || 0;
  const fi = totals.fiber || 0;

  // 進捗率 (%)
  const getPercent = (val, max) => (max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0);

  // PFC エネルギー比率 (%)
  const pfc = useMemo(() => calculatePfcRatio(p, f, c), [p, f, c]);

  // 食事タイプ別（朝・昼・夕・間食）小計集計
  const mealTypeSummary = useMemo(() => {
    const types = [
      { key: 'breakfast', label: '朝食', icon: '🌅', color: '#f59e0b' },
      { key: 'lunch', label: '昼食', icon: '☀️', color: '#10b981' },
      { key: 'dinner', label: '夕食', icon: '🌙', color: '#6366f1' },
      { key: 'snack', label: '間食', icon: '☕', color: '#ec4899' },
    ];

    return types.map((t) => {
      const filtered = mealLogs.filter((log) => log.mealType === t.key);
      const subTotal = filtered.reduce(
        (acc, log) => {
          acc.calories += Number(log.calories) || 0;
          acc.protein += Number(log.protein) || 0;
          acc.fat += Number(log.fat) || 0;
          acc.carbs += Number(log.carbs) || 0;
          return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );
      return {
        ...t,
        count: filtered.length,
        ...subTotal,
      };
    });
  }, [mealLogs]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📊 今日の栄養摂取進捗</Text>

      {/* 1. 総カロリー進捗バー */}
      <View style={styles.mainCalBox}>
        <View style={styles.mainCalTextRow}>
          <Text style={styles.mainCalLabel}>総摂取カロリー</Text>
          <Text style={styles.mainCalVal}>
            {Math.round(cal)} <Text style={styles.unitText}>/ {goalCal} kcal</Text>
          </Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${getPercent(cal, goalCal)}%`, backgroundColor: '#10b981' }]} />
        </View>
      </View>

      {/* 2. PFC エネルギー比率 (P:F:C %) プロポーショナルバー */}
      <View style={styles.pfcRatioBox}>
        <View style={styles.pfcHeaderRow}>
          <Text style={styles.pfcRatioTitle}>⚖️ PFCエネルギー比率</Text>
          <Text style={styles.pfcIdeaHint}>理想目安: P 15-25% / F 20-30% / C 50-65%</Text>
        </View>

        {/* 3色積み上げプロポーショナルバー */}
        <View style={styles.pfcPropBarBg}>
          {pfc.totalCal > 0 ? (
            <>
              {pfc.pRatio > 0 && (
                <View style={[styles.pfcPropSeg, { width: `${pfc.pRatio}%`, backgroundColor: '#06b6d4' }]} />
              )}
              {pfc.fRatio > 0 && (
                <View style={[styles.pfcPropSeg, { width: `${pfc.fRatio}%`, backgroundColor: '#f59e0b' }]} />
              )}
              {pfc.cRatio > 0 && (
                <View style={[styles.pfcPropSeg, { width: `${pfc.cRatio}%`, backgroundColor: '#a855f7' }]} />
              )}
            </>
          ) : (
            <View style={[styles.pfcPropSeg, { width: '100%', backgroundColor: '#334155' }]} />
          )}
        </View>

        {/* PFC 数値 ＆ % 一覧ラベル */}
        <View style={styles.pfcValLegendRow}>
          <View style={styles.pfcLegendItem}>
            <View style={[styles.pfcDot, { backgroundColor: '#06b6d4' }]} />
            <Text style={styles.pfcLegendLabel}>P (タンパク質):</Text>
            <Text style={styles.pfcLegendVal}>{pfc.pRatio}%</Text>
            <Text style={styles.pfcLegendKcal}>({pfc.pCal}kcal)</Text>
          </View>

          <View style={styles.pfcLegendItem}>
            <View style={[styles.pfcDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.pfcLegendLabel}>F (脂質):</Text>
            <Text style={styles.pfcLegendVal}>{pfc.fRatio}%</Text>
            <Text style={styles.pfcLegendKcal}>({pfc.fCal}kcal)</Text>
          </View>

          <View style={styles.pfcLegendItem}>
            <View style={[styles.pfcDot, { backgroundColor: '#a855f7' }]} />
            <Text style={styles.pfcLegendLabel}>C (炭水化物):</Text>
            <Text style={styles.pfcLegendVal}>{pfc.cRatio}%</Text>
            <Text style={styles.pfcLegendKcal}>({pfc.cCal}kcal)</Text>
          </View>
        </View>
      </View>

      {/* 3. PFC & 塩分 & 食物繊維 目標進捗グリッド */}
      <View style={styles.grid}>
        {/* P: タンパク質 */}
        <View style={styles.gridItem}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel}>タンパク質 (P)</Text>
            <Text style={styles.itemVal}>{p.toFixed(1)} <Text style={styles.subUnit}>/ {goalP}g</Text></Text>
          </View>
          <View style={styles.subProgressBg}>
            <View style={[styles.subProgressFill, { width: `${getPercent(p, goalP)}%`, backgroundColor: '#06b6d4' }]} />
          </View>
        </View>

        {/* F: 脂質 */}
        <View style={styles.gridItem}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel}>脂質 (F)</Text>
            <Text style={styles.itemVal}>{f.toFixed(1)} <Text style={styles.subUnit}>/ {goalF}g</Text></Text>
          </View>
          <View style={styles.subProgressBg}>
            <View style={[styles.subProgressFill, { width: `${getPercent(f, goalF)}%`, backgroundColor: '#f59e0b' }]} />
          </View>
        </View>

        {/* C: 炭水化物 */}
        <View style={styles.gridItem}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel}>炭水化物 (C)</Text>
            <Text style={styles.itemVal}>{c.toFixed(1)} <Text style={styles.subUnit}>/ {goalC}g</Text></Text>
          </View>
          <View style={styles.subProgressBg}>
            <View style={[styles.subProgressFill, { width: `${getPercent(c, goalC)}%`, backgroundColor: '#a855f7' }]} />
          </View>
        </View>

        {/* 塩分 */}
        <View style={styles.gridItem}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel}>塩分</Text>
            <Text style={styles.itemVal}>{s.toFixed(1)} <Text style={styles.subUnit}>/ {goalS}g</Text></Text>
          </View>
          <View style={styles.subProgressBg}>
            <View style={[styles.subProgressFill, { width: `${getPercent(s, goalS)}%`, backgroundColor: s > goalS ? '#ef4444' : '#f43f5e' }]} />
          </View>
        </View>

        {/* 食物繊維 */}
        <View style={styles.gridItemFull}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel}>🌾 食物繊維</Text>
            <Text style={styles.itemVal}>{fi.toFixed(1)} <Text style={styles.subUnit}>/ {goalFi}g</Text></Text>
          </View>
          <View style={styles.subProgressBg}>
            <View style={[styles.subProgressFill, { width: `${getPercent(fi, goalFi)}%`, backgroundColor: '#10b981' }]} />
          </View>
        </View>
      </View>

      {/* 4. 食事タイプ別（朝・昼・夕・間食）摂取内訳カード */}
      <View style={styles.mealBreakdownSection}>
        <Text style={styles.mealBreakdownTitle}>🍽️ 食事タイプ別 摂取内訳</Text>
        <View style={styles.mealBreakdownGrid}>
          {mealTypeSummary.map((item) => (
            <View key={item.key} style={styles.mealBreakdownCard}>
              <View style={styles.mealCardHeader}>
                <Text style={styles.mealIconLabel}>{item.icon} {item.label}</Text>
                <Text style={[styles.mealBadge, { borderColor: item.color, color: item.color }]}>
                  {item.count}件
                </Text>
              </View>

              <Text style={styles.mealCalVal}>
                {Math.round(item.calories)} <Text style={styles.mealCalUnit}>kcal</Text>
              </Text>

              <View style={styles.mealPfcMiniRow}>
                <Text style={styles.mealPfcText}><Text style={{ color: '#06b6d4' }}>P:</Text>{item.protein.toFixed(1)}g</Text>
                <Text style={styles.mealPfcText}><Text style={{ color: '#f59e0b' }}>F:</Text>{item.fat.toFixed(1)}g</Text>
                <Text style={styles.mealPfcText}><Text style={{ color: '#a855f7' }}>C:</Text>{item.carbs.toFixed(1)}g</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  mainCalBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  mainCalTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mainCalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  mainCalVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  unitText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '400',
  },
  progressBg: {
    height: 10,
    backgroundColor: '#334155',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },

  /* PFC 比率スタイル */
  pfcRatioBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pfcHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pfcRatioTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  pfcIdeaHint: {
    fontSize: 10,
    color: '#64748b',
  },
  pfcPropBarBg: {
    height: 14,
    backgroundColor: '#334155',
    borderRadius: 7,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 10,
  },
  pfcPropSeg: {
    height: '100%',
  },
  pfcValLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  pfcLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pfcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pfcLegendLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  pfcLegendVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  pfcLegendKcal: {
    fontSize: 10,
    color: '#64748b',
  },

  /* グリッドスタイル */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
  },
  gridItemFull: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  itemVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subUnit: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '400',
  },
  subProgressBg: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  subProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  /* 食事タイプ別内訳スタイル */
  mealBreakdownSection: {
    marginTop: 4,
  },
  mealBreakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  mealBreakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealBreakdownCard: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealIconLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  mealBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
  },
  mealCalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 4,
  },
  mealCalUnit: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '400',
  },
  mealPfcMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  mealPfcText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
