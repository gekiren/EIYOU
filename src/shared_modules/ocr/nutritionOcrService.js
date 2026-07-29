import { createWorker } from 'tesseract.js';

/**
 * オンデバイス tesseract.js によるテキスト抽出
 */
export async function extractNutritionTextWithOCR(base64Image) {
  if (typeof window === 'undefined' || !window.document) {
    // Native環境ではTesseract Workerが動かないためスキップ
    return { text: '', confidence: 0 };
  }
  let worker = null;
  try {
    worker = await createWorker('jpn+eng');
    const { data } = await worker.recognize(base64Image);
    return {
      text: data.text || '',
      confidence: data.confidence || 0
    };
  } catch (err) {
    console.warn('Tesseract OCR Skip/Error:', err);
    return { text: '', confidence: 0 };
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

/**
 * OCR抽出版面テキストから熱量・タンパク質・脂質・炭水化物を正規表現抽出するルールベース解析
 */
export async function parseNutritionOcrText(ocrText) {
  if (!ocrText) {
    return {
      isFood: false,
      reason: '画像からテキストを抽出できませんでした。'
    };
  }

  const cleanText = ocrText.replace(/\s+/g, '');

  // カロリー (熱量, エネルギー, kcal)
  const calMatch = cleanText.match(/(?:熱量|エネルギー|カロリー)[:：]?([0-9.]+)(?:kcal|キロカロリー)?/i);
  // たんぱく質 (タンパク質, たんぱく質, g)
  const proteinMatch = cleanText.match(/(?:たんぱく質|タンパク質|蛋白質)[:：]?([0-9.]+)g?/i);
  // 脂質 (脂質, g)
  const fatMatch = cleanText.match(/(?:脂質)[:：]?([0-9.]+)g?/i);
  // 炭水化物 (炭水化物, 糖質, g)
  const carbsMatch = cleanText.match(/(?:炭水化物|糖質)[:：]?([0-9.]+)g?/i);

  const calories = calMatch ? parseFloat(calMatch[1]) : 0;
  const protein = proteinMatch ? parseFloat(proteinMatch[1]) : 0;
  const fat = fatMatch ? parseFloat(fatMatch[1]) : 0;
  const carbs = carbsMatch ? parseFloat(carbsMatch[1]) : 0;

  const hasNutrition = calories > 0 || protein > 0 || fat > 0 || carbs > 0;

  return {
    isFood: hasNutrition,
    mealName: hasNutrition ? '栄養成分表示スキャン品' : '名称不明食品',
    calories,
    protein,
    fat,
    carbs,
    sodium: 0,
    ingredients: [],
    advice: hasNutrition ? 'オンデバイスOCRにより成分表示ラベルから数値を読み取りました。' : '成分数値を自動判定できませんでした。手動で調整してください。'
  };
}
