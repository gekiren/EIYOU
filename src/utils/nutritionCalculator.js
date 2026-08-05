/**
 * 栄養計算ユーティリティ (nutritionCalculator.js)
 * - Mifflin-St Jeor 式による BMR (基礎代謝量) 計算
 * - 活動レベルに応じた TDEE (総消費エネルギー) 計算
 * - 目的別 (減量 / 維持 / 増量) の目標カロリーおよび推奨 PFC / 塩分 / 食物繊維の自動算出
 * - PFC エネルギー比率 (P:F:C %) 計算
 */

/**
 * BMR (基礎代謝量) の計算 (Mifflin-St Jeor 公式)
 * @param {Object} params
 * @param {'male'|'female'} params.gender
 * @param {number} params.age - 年齢 (歳)
 * @param {number} params.height - 身長 (cm)
 * @param {number} params.weight - 体重 (kg)
 * @returns {number} BMR (kcal)
 */
export function calculateBmr({ gender = 'male', age = 30, height = 170, weight = 65 }) {
  const w = Number(weight) || 0;
  const h = Number(height) || 0;
  const a = Number(age) || 0;

  if (w <= 0 || h <= 0 || a <= 0) return 0;

  // Mifflin-St Jeor 公式
  // 男性: 10 * 体重(kg) + 6.25 * 身長(cm) - 5 * 年齢(歳) + 5
  // 女性: 10 * 体重(kg) + 6.25 * 身長(cm) - 5 * 年齢(歳) - 161
  const base = 10 * w + 6.25 * h - 5 * a;
  const bmr = gender === 'female' ? base - 161 : base + 5;

  return Math.max(0, Math.round(bmr));
}

/**
 * TDEE (1日総消費カロリー) の計算
 * @param {number} bmr - 基礎代謝量
 * @param {'sedentary'|'light'|'moderate'|'active'|'veryActive'} activityLevel - 活動レベル
 * @returns {number} TDEE (kcal)
 */
export function calculateTdee(bmr, activityLevel = 'moderate') {
  if (!bmr || bmr <= 0) return 0;

  const multipliers = {
    sedentary: 1.2,      // デスクワーク・ほぼ運動しない
    light: 1.375,        // 立ち仕事・軽度の運動 (週1-3日)
    moderate: 1.55,      // 適度な運動 (週3-5日)
    active: 1.725,       // 活発な運動 (週6-7日)
    veryActive: 1.9,     // 非常に激しい運動・アスリート
  };

  const mult = multipliers[activityLevel] || 1.55;
  return Math.round(bmr * mult);
}

/**
 * 目的別目標カロリー ＆ 推奨栄養素の自動算出
 * @param {Object} params
 * @param {'male'|'female'} params.gender
 * @param {number} params.age
 * @param {number} params.height
 * @param {number} params.weight
 * @param {'sedentary'|'light'|'moderate'|'active'|'veryActive'} params.activityLevel
 * @param {'cut'|'maintain'|'bulk'} params.goalType - 'cut' (-15%), 'maintain' (0%), 'bulk' (+10%)
 * @returns {Object} { bmr, tdee, calories, protein, fat, carbs, sodium, fiber }
 */
export function calculateTargetGoals({
  gender = 'male',
  age = 30,
  height = 170,
  weight = 65,
  activityLevel = 'moderate',
  goalType = 'maintain'
}) {
  const bmr = calculateBmr({ gender, age, height, weight });
  const tdee = calculateTdee(bmr, activityLevel);

  if (tdee <= 0) {
    return {
      bmr: 0,
      tdee: 0,
      calories: 2200,
      protein: 75,
      fat: 60,
      carbs: 280,
      sodium: 7.0,
      fiber: 20.0
    };
  }

  // 目的別目標カロリー係数
  const goalMultipliers = {
    cut: 0.85,      // 15% 減量
    maintain: 1.0,  // 維持
    bulk: 1.10,     // 10% 増量
  };

  const mult = goalMultipliers[goalType] ?? 1.0;
  const targetCalories = Math.round(tdee * mult);

  // 推奨 PFC エネルギー比率 (P 20% / F 25% / C 55%)
  // タンパク質: 4 kcal/g
  // 脂質: 9 kcal/g
  // 炭水化物: 4 kcal/g
  const proteinG = Math.round((targetCalories * 0.20) / 4);
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbsG = Math.round((targetCalories * 0.55) / 4);

  // 塩分目安 (厚生労働省目標量: 男性 7.5g未満, 女性 6.5g未満)
  const sodiumG = gender === 'female' ? 6.5 : 7.5;

  // 食物繊維目安 (20.0g)
  const fiberG = 20.0;

  return {
    bmr,
    tdee,
    calories: targetCalories,
    protein: proteinG,
    fat: fatG,
    carbs: carbsG,
    sodium: sodiumG,
    fiber: fiberG
  };
}

/**
 * PFC エネルギー比率 (P:F:C %) の計算
 * @param {number} protein - タンパク質 (g)
 * @param {number} fat - 脂質 (g)
 * @param {number} carbs - 炭水化物 (g)
 * @returns {Object} { pCal, fCal, cCal, totalCal, pRatio, fRatio, cRatio }
 */
export function calculatePfcRatio(protein = 0, fat = 0, carbs = 0) {
  const pG = Number(protein) || 0;
  const fG = Number(fat) || 0;
  const cG = Number(carbs) || 0;

  const pCal = pG * 4;
  const fCal = fG * 9;
  const cCal = cG * 4;

  const totalCal = pCal + fCal + cCal;

  if (totalCal <= 0) {
    return {
      pCal: 0,
      fCal: 0,
      cCal: 0,
      totalCal: 0,
      pRatio: 0,
      fRatio: 0,
      cRatio: 0
    };
  }

  const pRatio = Math.round((pCal / totalCal) * 100);
  const fRatio = Math.round((fCal / totalCal) * 100);
  // 合計がちょうど 100% になるよう C を調整
  const cRatio = Math.max(0, 100 - pRatio - fRatio);

  return {
    pCal: Math.round(pCal),
    fCal: Math.round(fCal),
    cCal: Math.round(cCal),
    totalCal: Math.round(totalCal),
    pRatio,
    fRatio,
    cRatio
  };
}
