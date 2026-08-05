import * as Haptics from 'expo-haptics';

/**
 * 成功時（ログ追加完了、保存完了等）の触覚フィードバック
 */
export const triggerSuccess = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    // サイレントフォールバック (Webや非対応端末)
  }
};

/**
 * ボタンタップやお気に入り切替等のインパクト演出
 * @param {'light' | 'medium' | 'heavy'} style 
 */
export const triggerImpact = async (style = 'medium') => {
  try {
    let feedbackStyle = Haptics.ImpactFeedbackStyle.Medium;
    if (style === 'light') feedbackStyle = Haptics.ImpactFeedbackStyle.Light;
    if (style === 'heavy') feedbackStyle = Haptics.ImpactFeedbackStyle.Heavy;
    await Haptics.impactAsync(feedbackStyle);
  } catch (error) {
    // サイレントフォールバック
  }
};

/**
 * 削除・警告発生時の触覚フィードバック
 */
export const triggerWarning = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    // サイレントフォールバック
  }
};

export default {
  triggerSuccess,
  triggerImpact,
  triggerWarning,
};
