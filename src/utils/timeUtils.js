/**
 * EIYOU 時刻・食事区分計算ユーティリティ
 */

/**
 * 現在時刻または指定された Date オブジェクトから "HH:mm" 文字列を取得
 * @param {Date} [date=new Date()]
 * @returns {string} "HH:mm" 形式の文字列
 */
export function getCurrentTimeString(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 時刻（0〜23）から最適な食事区分 (breakfast | lunch | dinner | snack) を判定
 * @param {number} hour - 0〜23の数値
 * @returns {string} 'breakfast' | 'lunch' | 'snack' | 'dinner'
 */
export function getMealTypeFromHour(hour) {
  const h = Number(hour);
  if (isNaN(h)) return 'lunch';

  if (h >= 4 && h < 11) {
    return 'breakfast'; // 04:00 - 10:59 は朝食
  } else if (h >= 11 && h < 15) {
    return 'lunch'; // 11:00 - 14:59 は昼食
  } else if (h >= 15 && h < 17) {
    return 'snack'; // 15:00 - 16:59 は間食
  } else {
    return 'dinner'; // 17:00 - 03:59 は夕食
  }
}

/**
 * 現在時刻から初期表示用の "HH:mm" と mealType を一括取得
 * @param {Date} [date=new Date()]
 * @returns {{ mealTime: string, mealType: string }}
 */
export function getInitialMealTimeAndType(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const mealTime = getCurrentTimeString(d);
  const mealType = getMealTypeFromHour(d.getHours());
  return { mealTime, mealType };
}
