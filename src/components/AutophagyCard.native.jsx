import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  PanResponder,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { calculateAutophagyStatus } from '../shared_modules/autophagy/autophagyService.js';
import { recommendAutophagyTime } from '../shared_modules/ai/nutritionAiService.js';
import { triggerImpact } from '../utils/hapticsService.js';

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

  // スワイプ中のローカル時間表示用ステート
  const [displayHours, setDisplayHours] = useState(targetHours);
  const isDraggingRef = useRef(false);

  // AI最適化提案用ステート
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);

  // カスタム手動入力モーダル用ステート
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [customHoursText, setCustomHoursText] = useState('16');
  const [customMinutesText, setCustomMinutesText] = useState('0');

  // スライダー幅計測用
  const [sliderWidth, setSliderWidth] = useState(240);
  const sliderWidthRef = useRef(240);
  const targetHoursRef = useRef(targetHours);
  const MIN_HOURS = 8.0;
  const MAX_HOURS = 24.0;
  const STEP = 0.5;

  useEffect(() => {
    targetHoursRef.current = targetHours;
    if (!isDraggingRef.current) {
      setDisplayHours(targetHours);
    }
  }, [targetHours]);

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
    triggerImpact('medium');
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
    triggerImpact('medium');
    const nowIso = new Date().toISOString();
    onChangeConfig({
      ...config,
      enabled: true,
      startTime: nowIso,
      notified: false,
    });
  };

  // 目標時間の変更（即時保存）
  const handleSelectTargetHours = (hours) => {
    const rounded = Math.round(hours * 100) / 100;
    const clamped = Math.min(168, Math.max(1, rounded)); // 全体制限: 1h~168h
    setDisplayHours(clamped);
    targetHoursRef.current = clamped;
    if (clamped !== targetHours) {
      triggerImpact('light');
      onChangeConfig({
        ...config,
        targetHours: clamped,
        notified: false,
      });
    }
  };

  // 0.5時間刻みのインクリメント/デクリメント
  const handleStepHours = (delta) => {
    const next = Math.round((displayHours + delta) * 2) / 2;
    handleSelectTargetHours(next);
  };

  // PanResponder によるスワイプ調整 (スワイプ中はローカル表示のみ更新)
  const sliderTrackRef = useRef(null);
  const containerPageXRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        updateHoursFromTouchLocal(evt.nativeEvent);
      },
      onPanResponderMove: (evt) => {
        updateHoursFromTouchLocal(evt.nativeEvent);
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        triggerImpact('medium');
        // スワイプ完了時に 1 度だけ親に通知・永続化保存
        const finalHours = targetHoursRef.current;
        if (finalHours !== targetHours) {
          onChangeConfig({
            ...config,
            targetHours: finalHours,
            notified: false,
          });
        }
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
      },
    })
  ).current;

  const updateHoursFromTouchLocal = (nativeEvent) => {
    const w = sliderWidthRef.current || 240;
    let touchX = nativeEvent.locationX;

    // もし pageX とコンテナ絶対座標が取得できている場合はそちらを優先
    if (nativeEvent.pageX !== undefined && containerPageXRef.current > 0) {
      touchX = nativeEvent.pageX - containerPageXRef.current;
    }

    const ratio = Math.min(1, Math.max(0, touchX / w));
    const rawHours = MIN_HOURS + ratio * (MAX_HOURS - MIN_HOURS);
    const steppedHours = Math.round(rawHours * 2) / 2; // 0.5単位に丸め
    if (steppedHours !== targetHoursRef.current) {
      targetHoursRef.current = steppedHours;
      setDisplayHours(steppedHours);
      triggerImpact('selection');
    }
  };

  // AI最適化提案の実行
  const handleAnalyzeAiRecommendation = async () => {
    triggerImpact('light');
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

  // モーダルを開く
  const handleOpenCustomModal = () => {
    triggerImpact('light');
    const h = Math.floor(displayHours);
    const m = Math.round((displayHours - h) * 60);
    setCustomHoursText(String(h));
    setCustomMinutesText(String(m));
    setIsCustomModalVisible(true);
  };

  // モーダルでカスタム時間を保存
  const handleSaveCustomHours = () => {
    const hoursNum = parseInt(customHoursText, 10) || 0;
    const minutesNum = parseInt(customMinutesText, 10) || 0;
    const totalHours = hoursNum + minutesNum / 60;

    if (totalHours < 1 || totalHours > 168) {
      Alert.alert('入力エラー', '絶食目標時間は1時間から168時間(7日間)の範囲で設定してください。');
      return;
    }

    handleSelectTargetHours(totalHours);
    setIsCustomModalVisible(false);
  };

  // クイック入力（28h, 36h, 48h, 72h など）
  const handleSelectQuickCustom = (h) => {
    setCustomHoursText(String(h));
    setCustomMinutesText('0');
  };

  const presetHours = [12, 14, 16, 18, 20, 24];

  // 時間のフォーマット補助 (例: 16.5 -> 16時間30分)
  const formatHoursText = (h) => {
    const whole = Math.floor(h);
    const mins = Math.round((h - whole) * 60);
    if (mins === 0) {
      return `${whole}時間`;
    }
    return `${whole}時間${mins}分`;
  };

  const currentDisplayHours = isDraggingRef.current ? displayHours : targetHours;
  const progressRatio = Math.min(1, Math.max(0, (displayHours - MIN_HOURS) / (MAX_HOURS - MIN_HOURS)));

  return (
    <View style={styles.card}>
      {/* カードヘッダー */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>⌛</Text>
          <View>
            <Text style={styles.title}>オートファジー監視タイマー</Text>
            <Text style={styles.subtitle}>
              目標絶食時間: <Text style={styles.targetHoursHighlight}>{currentDisplayHours}h</Text> ({formatHoursText(currentDisplayHours)})
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: '#334155', true: '#059669' }}
          thumbColor={enabled ? '#10b981' : '#94a3b8'}
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
              { backgroundColor: status.phaseColor || '#3b82f6' },
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
                  backgroundColor: status.phaseColor || '#10b981',
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

      {/* AI最適化提案 ＆ 目標絶食時間スワイプ調整 */}
      <View style={styles.targetSelector}>
        <View style={styles.selectorHeader}>
          <Text style={styles.selectorLabel}>目標絶食時間の調整 (8h〜24h スワイプ):</Text>
          <TouchableOpacity
            style={styles.aiSuggestBtn}
            onPress={handleAnalyzeAiRecommendation}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.aiSuggestBtnText}>🤖 AI提案</Text>
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

        {/* 30分単位 スワイプ調整用インタラクティブスライダー */}
        <View style={styles.swipeControlContainer}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleStepHours(-STEP)}
          >
            <Text style={styles.stepBtnText}>-30分</Text>
          </TouchableOpacity>

          <View
            ref={sliderTrackRef}
            style={styles.sliderTrackContainer}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              setSliderWidth(w);
              sliderWidthRef.current = w;
              if (sliderTrackRef.current && sliderTrackRef.current.measure) {
                sliderTrackRef.current.measure((x, y, width, height, pageX) => {
                  if (pageX) {
                    containerPageXRef.current = pageX;
                  }
                });
              }
            }}
            {...panResponder.panHandlers}
          >
            <View style={styles.sliderTrackBg} pointerEvents="none">
              <View
                style={[
                  styles.sliderTrackFill,
                  { width: `${progressRatio * 100}%` },
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${Math.max(0, Math.min(94, progressRatio * 94))}%` },
                ]}
              >
                <Text style={styles.sliderThumbText}>{displayHours}h</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => handleStepHours(STEP)}
          >
            <Text style={styles.stepBtnText}>+30分</Text>
          </TouchableOpacity>
        </View>

        {/* プリセットボタン ＆ カスタム入力ボタン */}
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
          <TouchableOpacity
            style={styles.customInputBtn}
            onPress={handleOpenCustomModal}
          >
            <Text style={styles.customInputBtnText}>✏️ カスタム</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* カスタム（手動）時間入力モーダル */}
      <Modal
        visible={isCustomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>✏️ 絶食目標時間の手動設定</Text>
                  <TouchableOpacity
                    onPress={() => setIsCustomModalVisible(false)}
                    style={styles.modalCloseBtn}
                  >
                    <Text style={styles.modalCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubText}>
                  24時間以上の長期間絶食や、30分単位以外の任意時間を手動で自由に設定できます。
                </Text>

                {/* 時間・分入力フィールド */}
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>時間 (Hours)</Text>
                    <TextInput
                      style={styles.numberInput}
                      keyboardType="number-pad"
                      value={customHoursText}
                      onChangeText={setCustomHoursText}
                      placeholder="16"
                      placeholderTextColor="#64748b"
                      maxLength={3}
                    />
                  </View>
                  <Text style={styles.inputUnitText}>時間</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>分 (Minutes)</Text>
                    <TextInput
                      style={styles.numberInput}
                      keyboardType="number-pad"
                      value={customMinutesText}
                      onChangeText={setCustomMinutesText}
                      placeholder="0"
                      placeholderTextColor="#64748b"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.inputUnitText}>分</Text>
                </View>

                {/* クイック選択タグ */}
                <Text style={styles.quickLabel}>長期間絶食クイック選択:</Text>
                <View style={styles.quickRow}>
                  {[24, 28, 36, 48, 72].map((qh) => (
                    <TouchableOpacity
                      key={qh}
                      style={styles.quickTag}
                      onPress={() => handleSelectQuickCustom(qh)}
                    >
                      <Text style={styles.quickTagText}>{qh}時間</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* アクションボタン */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setIsCustomModalVisible(false)}
                  >
                    <Text style={styles.cancelBtnText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveCustomHours}
                  >
                    <Text style={styles.saveBtnText}>保存して適用</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  targetHoursHighlight: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  content: {
    marginTop: 4,
  },
  completeBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  completeBannerText: {
    color: '#34d399',
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
    color: '#cbd5e1',
    marginBottom: 10,
    lineHeight: 16,
  },
  progressBg: {
    height: 10,
    backgroundColor: '#334155',
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
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  timeVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    fontVariant: ['tabular-nums'],
  },
  completedTimeVal: {
    color: '#34d399',
  },
  timeDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#334155',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  startTimeText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  resetBtn: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledContent: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 10,
  },
  startBtn: {
    backgroundColor: '#d97706',
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
    borderTopColor: '#334155',
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  aiSuggestBtn: {
    backgroundColor: '#7c3aed',
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
    backgroundColor: '#2e1065',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#581c87',
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
    color: '#c084fc',
  },
  applyAiBtn: {
    backgroundColor: '#7e22ce',
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
    color: '#e9d5ff',
    lineHeight: 16,
    marginBottom: 4,
  },
  aiAdviceText: {
    fontSize: 11,
    color: '#ddd6fe',
    lineHeight: 15,
  },
  /* スワイプ調整スライダー領域 */
  swipeControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
  },
  stepBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  sliderTrackContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  sliderTrackBg: {
    height: 12,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
    justifyContent: 'center',
  },
  sliderTrackFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 6,
  },
  sliderThumb: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  sliderThumbText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '800',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetBtnActive: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  presetBtnText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: '#34d399',
    fontWeight: '700',
  },
  /* カスタム時間入力ボタン＆モーダル スタイル */
  customInputBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  customInputBtnText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseBtnText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700',
  },
  modalSubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  inputGroup: {
    alignItems: 'center',
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 4,
  },
  numberInput: {
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
    width: '80%',
    paddingVertical: 6,
  },
  inputUnitText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '700',
    marginHorizontal: 8,
  },
  quickLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  quickTag: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickTagText: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  cancelBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
