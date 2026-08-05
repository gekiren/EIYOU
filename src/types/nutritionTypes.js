/**
 * EIYOU 栄養データ型定義 ＆ バリデーションモジュール
 * @module nutritionTypes
 */

/**
 * @typedef {Object} AiNutritionAnalysisResult
 * @property {boolean} [isFood=true] - 食品・料理を検知できたか否か
 * @property {string} [mealName] - 食品・料理名
 * @property {number} calories - カロリー(kcal)
 * @property {number} protein - タンパク質(g)
 * @property {number} fat - 脂質(g)
 * @property {number} carbs - 炭水化物(g)
 * @property {number} sodium - 塩分相当量(g)
 * @property {number} fiber - 食物繊維(g)
 * @property {string[]} [ingredients] - 主要食材リスト
 * @property {string} [advice] - ワンポイントアドバイス
 * @property {string} [reason] - 食品非検知理由 (isFood=false 時)
 */

/**
 * @typedef {Object} UserGoals
 * @property {number} calories - 目標カロリー(kcal)
 * @property {number} protein - 目標タンパク質(g)
 * @property {number} fat - 目標脂質(g)
 * @property {number} carbs - 目標炭水化物(g)
 * @property {number} sodium - 上限塩分相当量(g)
 * @property {number} fiber - 目標食物繊維(g)
 */

/**
 * 安全に数値をパースし、NaN や無限大を防止して丸める補助関数
 * @param {any} value - 対象の値
 * @param {number} [fallback=0] - デフォルト値
 * @param {number} [decimals=1] - 小数点以下の桁数
 * @returns {number}
 */
export function parseSafeNumber(value, fallback = 0, decimals = 1) {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return fallback;
  if (decimals === 0) return Math.round(num);
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * AI解析レスポンスまたは各種栄養データを正規化・バリデーションする
 * @param {any} rawData - AI返却オブジェクト
 * @returns {AiNutritionAnalysisResult} 正規化済みの栄養データ
 */
export function validateAndNormalizeNutritionResult(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return {
      isFood: false,
      mealName: '不明な食品',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      sodium: 0,
      fiber: 0,
      ingredients: [],
      advice: '栄養データを解析できませんでした。',
      reason: 'AIからのレスポンス形式が不正です。'
    };
  }

  const isFood = rawData.isFood !== false; // 明示的に false でない限り true

  return {
    isFood,
    mealName: typeof rawData.mealName === 'string' && rawData.mealName.trim()
      ? rawData.mealName.trim()
      : '食事・料理',
    calories: parseSafeNumber(rawData.calories, 0, 0),
    protein: parseSafeNumber(rawData.protein, 0, 1),
    fat: parseSafeNumber(rawData.fat, 0, 1),
    carbs: parseSafeNumber(rawData.carbs, 0, 1),
    sodium: parseSafeNumber(rawData.sodium, 0, 1),
    fiber: parseSafeNumber(rawData.fiber, 0, 1),
    ingredients: Array.isArray(rawData.ingredients)
      ? rawData.ingredients.filter(item => typeof item === 'string' && item.trim())
      : [],
    advice: typeof rawData.advice === 'string' ? rawData.advice.trim() : '',
    reason: typeof rawData.reason === 'string' ? rawData.reason.trim() : ''
  };
}
