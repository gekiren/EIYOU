import { safeStorage } from '../storage/safeStorage.js';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  console.warn('[autophagyService] expo-notifications module not loaded:', e.message);
}

const AUTOPHAGY_STORAGE_KEY = 'eiyou_autophagy_config_v1';

export const DEFAULT_AUTOPHAGY_CONFIG = {
  enabled: false,
  targetHours: 16,
  startTime: null,
  notified: false,
  autoSyncWithLastMeal: true,
};

/**
 * オートファジー設定を読み込む
 */
export async function loadAutophagyConfig() {
  try {
    const raw = await safeStorage.getItem(AUTOPHAGY_STORAGE_KEY, '');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AUTOPHAGY_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('[autophagyService] Failed to load config:', e);
  }
  return { ...DEFAULT_AUTOPHAGY_CONFIG };
}

/**
 * オートファジー設定を保存する
 */
export async function saveAutophagyConfig(config) {
  try {
    await safeStorage.setItem(AUTOPHAGY_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('[autophagyService] Failed to save config:', e);
  }
}

/**
 * 目標時刻に向けたローカルプッシュ通知をスケジュールする
 */
export async function scheduleAutophagyNotification(startTime, targetHours) {
  if (!Notifications || !Notifications.scheduleNotificationAsync) {
    console.log('[autophagyService] Notifications module unavailable, skipping schedule.');
    return null;
  }

  try {
    // 既存のスケジュールをキャンセル
    await cancelAutophagyNotification();

    if (!startTime || !targetHours) return null;

    const startMs = new Date(startTime).getTime();
    const targetMs = startMs + targetHours * 60 * 60 * 1000;
    const nowMs = Date.now();
    const triggerSeconds = Math.max(1, Math.floor((targetMs - nowMs) / 1000));

    // 既に経過している場合はスケジュールしない
    if (targetMs <= nowMs) {
      return null;
    }

    // パーミッションの確認・要請
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[autophagyService] Notification permission not granted.');
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 オートファジー目標達成！',
        body: `${targetHours}時間の絶食が完了しました。細胞のリサイクルとオートファジー効果が最大化されました！`,
        sound: true,
        data: { type: 'autophagy_complete', targetHours },
      },
      trigger: {
        seconds: triggerSeconds,
      },
    });

    console.log(`[autophagyService] Notification scheduled ID: ${notificationId} in ${triggerSeconds} seconds.`);
    return notificationId;
  } catch (e) {
    console.warn('[autophagyService] Notification schedule error:', e);
    return null;
  }
}

/**
 * スケジュール済み通知のキャンセル
 */
export async function cancelAutophagyNotification() {
  if (!Notifications || !Notifications.cancelAllScheduledNotificationsAsync) {
    return;
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[autophagyService] Cancel notification error:', e);
  }
}

/**
 * 絶食時間の状態・経過・残り時間・フェーズの計算
 */
export function calculateAutophagyStatus(startTime, targetHours) {
  if (!startTime) {
    return {
      elapsedHours: 0,
      elapsedFormatted: '00:00:00',
      remainingFormatted: '00:00:00',
      progressPercent: 0,
      isCompleted: false,
      currentPhase: '未開始',
      phaseDescription: 'オートファジーをオンにして絶食を開始しましょう。',
      phaseColor: '#9e9e9e',
    };
  }

  const startMs = new Date(startTime).getTime();
  const nowMs = Date.now();
  const elapsedMs = Math.max(0, nowMs - startMs);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  const totalTargetMs = targetHours * 60 * 60 * 1000;
  const remainingMs = Math.max(0, totalTargetMs - elapsedMs);

  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalTargetMs) * 100));
  const isCompleted = elapsedMs >= totalTargetMs;

  // フォーマットヘルパー
  const formatMs = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const elapsedFormatted = formatMs(elapsedMs);
  const remainingFormatted = formatMs(remainingMs);

  // フェーズ判定
  let currentPhase = '';
  let phaseDescription = '';
  let phaseColor = '#2196f3';

  if (isCompleted) {
    currentPhase = '🎉 目標絶食完了！';
    phaseDescription = `${targetHours}時間のオートファジー絶食を完了しました！無理のない範囲で水分補給と栄養を補給しましょう。`;
    phaseColor = '#4caf50';
  } else if (elapsedHours < 4) {
    currentPhase = '🥗 消化・吸収期';
    phaseDescription = '前回の食事の栄養を消化・吸収し、主要なエネルギー源として利用しています。';
    phaseColor = '#2196f3';
  } else if (elapsedHours < 12) {
    currentPhase = '🔥 血糖低下・脂肪燃焼期';
    phaseDescription = 'グリコーゲンが消費され、エネルギー源が体脂肪の燃焼へ切り替わり始めています。';
    phaseColor = '#ff9800';
  } else {
    currentPhase = '⚡ オートファジー活性期';
    phaseDescription = '細胞内の古いタンパク質やミトコンドリアのデトックス・再利用が活性化しています！';
    phaseColor = '#9c27b0';
  }

  return {
    elapsedHours,
    elapsedFormatted,
    remainingFormatted,
    progressPercent,
    isCompleted,
    currentPhase,
    phaseDescription,
    phaseColor,
  };
}
