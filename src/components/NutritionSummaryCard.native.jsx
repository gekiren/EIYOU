import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function NutritionSummaryCard({ totals = {}, userGoals = {} }) {
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

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📊 今日の栄養摂取進捗</Text>

      {/* 総カロリー */}
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

      {/* PFC & 塩分 & 食物繊維 グリッド */}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
});
