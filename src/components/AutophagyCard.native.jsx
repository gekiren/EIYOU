import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { calculateAutophagyStatus } from '../shared_modules/autophagy/autophagyService.js';
import { recommendAutophagyTime } from '../shared_modules/ai/nutritionAiService.js';

export default function AutophagyCard({
  config = {},
  onChangeConfig = () => {},
  lastMealTime = null,
  last24hLogs = [],
  userGoals = {},
  preferredAiModel = 'gemini',
  aiThinkingMode = 'quick',
}) {
  const {
    enabled = false,
    targetHours = 16,
    startTime = null,
    notified = false,
  } = config;

  const [status, setStatus] = useState(() =>
    calculateAutophagyStatus(startTime, targetHours)
  );

  // AI最適化提案用ステート
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);

  // 1秒ごとに絶食カウントダウン・状態更新
  useEffect(() => {
    if (!enabled || !startTime) {
      setStatus(calculateAutophagyStatus(null, targetHours));
      return;
    }

    const updateStatus = () => {
      const currentStatus = calculateAutophagyStatus(startTime, targetHours);
      setStatus(currentStatus);

      // 目標到達かつ未通知の場合
      if (currentStatus.isCompleted && !notified) {
        onChangeConfig({ ...config, notified: true });
        Alert.alert(
          '🎉 オートファジー目標達成！',
          `${targetHours}時間の絶食管理を達成しました！細胞のデトックス・リサイクルが最大化されています。`
        );
      }
    };

    updateStatus();
    const timer = setInterval(updateStatus, 1000);
    return () => clearInterval(timer);
  }, [enabled, startTime, targetHours, notified]);

  // オートファジーON/OFF 切り替え
  const handleToggleEnabled = (val) => {
    if (val) {
      const newStart = startTime || lastMealTime || new Date().toISOString();
      onChangeConfig({
        ...config,
        enabled: true,
        startTime: newStart,
        notified: false,
      });
    } else {
      onChangeConfig({
        ...config,
        enabled: false,
      });
    }
  };

  // 手動で絶食スタート時刻を「現在時刻」にリセット
  const handleResetStartNow = () => {
    const nowIso = new Date().toISOString();
    onChangeConfig({
      ...config,
      enabled: true,
      startTime: nowIso,
      notified: false,
    });
  };

  // 目標時間の変更
  const handleSelectTargetHours = (hours) => {
    onChangeConfig({
      ...config,
      targetHours: hours,
      notified: false,
    });
  };

  // AI最適化提案の実行
  const handleAnalyzeAiRecommendation = async () => {
    setIsAnalyzing(true);
    setAiRecommendation(null);
    try {
      const res = await recommendAutophagyTime({
        last24hLogs,
        userGoals,
        preferredModel: preferredAiModel,
        thinkingMode: aiThinkingMode,
      });
      setAiRecommendation(res);
    } catch (e) {
      Alert.alert('AI提案エラー', '直近の食事分析に失敗しました。時間をおいて再試行してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 提案された目標時間の適用
  const handleApplyRecommendation = (hours) => {
    handleSelectTargetHours(hours);
    Alert.alert('🎯 目標適用完了', `AIが提案した ${hours}時間をオートファジー目標時間として設定しました！`);
  };

  const presetHours = [12, 14, 16, 18, 20];

  return (
    <View style={styles.card}>
      {/* カードヘッダー */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>⌛</Text>
          <View>
            <Text style={styles.title}>オートファジー監視タイマー</Text>
            <Text style={styles.subtitle}>目標絶食時間: {targetHours} 時間</Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: '#e0e0e0', true: '#c8e6c9' }}
          thumbColor={enabled ? '#4caf50' : '#9e9e9e'}
        />
      </View>

      {enabled ? (
        <View style={styles.content}>
          {/* 目標達成バナー */}
          {status.isCompleted && (
            <View style={styles.completeBanner}>
              <Text style={styles.completeBannerText}>
                🎉 祝！{targetHours}時間絶食達成！
              </Text>
            </View>
          )}

          {/* フェーズバッチ */}
          <View
            style={[
              styles.phaseBadge,
              { backgroundColor: status.phaseColor || '#2196f3' },
            ]}
          >
            <Text style={styles.phaseBadgeText}>{status.currentPhase}</Text>
          </View>
          <Text style={styles.phaseDesc}>{status.phaseDescription}</Text>

          {/* プログレスバー */}
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${status.progressPercent}%`,
                  backgroundColor: status.phaseColor || '#4caf50',
                },
              ]}
            />
          </View>

          {/* 時間カウント表示 */}
          <View style={styles.timeContainer}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>経過時間</Text>
              <Text style={styles.timeVal}>{status.elapsedFormatted}</Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>残り時間</Text>
              <Text style={[styles.timeVal, status.isCompleted && styles.completedTimeVal]}>
                {status.remainingFormatted}
              </Text>
            </View>
          </View>

          {/* 開始時刻情報 & リセットボタン */}
          <View style={styles.actionRow}>
            <Text style={styles.startTimeText}>
              開始: {startTime ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </Text>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetStartNow}>
              <Text style={styles.resetBtnText}>🔄 今すぐ再スタート</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.disabledContent}>
          <Text style={styles.disabledText}>
            オートファジー絶食タイマーはOFFになっています。
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => handleToggleEnabled(true)}
          >
            <Text style={styles.startBtnText}>🔥 絶食タイマーをONにする</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI最適化提案 ＆ 目標絶食時間選択 */}
      <View style={styles.targetSelector}>
        <View style={styles.selectorHeader}>
          <Text style={styles.selectorLabel}>目標絶食時間の設定:</Text>
          <TouchableOpacity
            style={styles.aiSuggestBtn}
            onPress={handleAnalyzeAiRecommendation}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.aiSuggestBtnText}>🤖 AI最適化提案</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* AI提案結果表示カード */}
        {aiRecommendation && (
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Text style={styles.aiCardTitle}>✨ AI推奨目標: {aiRecommendation.recommendedHours} 時間</Text>
              <TouchableOpacity
                style={styles.applyAiBtn}
                onPress={() => handleApplyRecommendation(aiRecommendation.recommendedHours)}
              >
                <Text style={styles.applyAiBtnText}>適用する</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.aiReasonText}>💡 【理由】{aiRecommendation.reason}</Text>
            {Boolean(aiRecommendation.advice) && (
              <Text style={styles.aiAdviceText}>💬 【アドバイス】{aiRecommendation.advice}</Text>
            )}
          </View>
        )}

        <View style={styles.presetRow}>
          {presetHours.map((hours) => (
            <TouchableOpacity
              key={hours}
              style={[
                styles.presetBtn,
                targetHours === hours && styles.presetBtnActive,
              ]}
              onPress={() => handleSelectTargetHours(hours)}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  targetHours === hours && styles.presetBtnTextActive,
                ]}
              >
                {hours}h
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  content: {
    marginTop: 4,
  },
  completeBanner: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  completeBannerText: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 14,
  },
  phaseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  phaseBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  phaseDesc: {
    fontSize: 12,
    color: '#616161',
    marginBottom: 10,
    lineHeight: 16,
  },
  progressBg: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  timeContainer: {
    flexDirection: 'row',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#eeeeee',
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: '#757575',
    marginBottom: 4,
  },
  timeVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#212121',
    fontVariant: ['tabular-nums'],
  },
  completedTimeVal: {
    color: '#4caf50',
  },
  timeDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#e0e0e0',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  startTimeText: {
    fontSize: 12,
    color: '#757575',
  },
  resetBtn: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#1976d2',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledContent: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledText: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 10,
  },
  startBtn: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  targetSelector: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '600',
  },
  aiSuggestBtn: {
    backgroundColor: '#7c4dff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  aiSuggestBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  aiCard: {
    backgroundColor: '#f3e5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e1bee7',
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a148c',
  },
  applyAiBtn: {
    backgroundColor: '#8e24aa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  applyAiBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  aiReasonText: {
    fontSize: 12,
    color: '#4a148c',
    lineHeight: 16,
    marginBottom: 4,
  },
  aiAdviceText: {
    fontSize: 11,
    color: '#6a1b9a',
    lineHeight: 15,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  presetBtnActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  presetBtnText: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: '#2e7d32',
    fontWeight: '700',
  },
});
