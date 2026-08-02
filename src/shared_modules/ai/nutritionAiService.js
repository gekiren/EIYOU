import { analyzeNutritionWithGemini } from './geminiNutritionService';
import { extractNutritionTextWithOCR, parseNutritionOcrText } from '../ocr/nutritionOcrService';
import { SECURE_WORKER_PROXY_URL } from '../../config/constants';

/**
 * DeepSeek V4 API による栄養・食事画像解析
 */
export async function analyzeNutritionWithDeepSeek(
  base64Image,
  apiKey,
  modelName = 'deepseek-v4-flash',
  ocrHintText = ''
) {
  if (!apiKey) throw new Error('DeepSeek APIキーが指定されていません。');

  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const hintPrompt = ocrHintText ? `\n【参考：オンデバイスOCR事前抽出テキスト】\n${ocrHintText}\n` : '';

  const prompt = `
提出された食事または栄養成分表示ラベルの画像から栄養データをJSONで抽出してください。
食品・料理以外の場合は "isFood": false, "reason": "食品または栄養成分表示ラベルを検知できませんでした。" にしてください。
食品の場合は "isFood": true にしてください。
${hintPrompt}
【返却JSONフォーマット】
{
  "isFood": true,
  "mealName": "料理名または食品名",
  "calories": 450,
  "protein": 25.5,
  "fat": 12.0,
  "carbs": 55.0,
  "sodium": 1.5,
  "fiber": 4.5,
  "ingredients": ["食材1", "食材2"],
  "advice": "栄養ワンポイントアドバイス"
}
`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: base64Image.startsWith('data:') ? base64Image : `data:${mimeType};base64,${cleanBase64}` } }
        ]
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek APIエラー (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content.trim());
}

/**
 * Cloudflare Worker プロキシ経由のリクエスト処理
 */
export async function analyzeNutritionWithWorkerProxy(base64Image, proxyUrl, ocrHintText = '', preferredModel = 'gemini') {
  const cleanUrl = proxyUrl.replace(/\/$/, '') + '/api/analyze-nutrition';

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, ocrHintText, preferredModel })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Workerプロキシ通信エラー (${response.status})`);
  }

  return await response.json();
}

/**
 * 統合栄養解析パイプライン
 * 1. オンデバイスOCRで成分表記テキストの事前取得
 * 2. Workerプロキシ / Gemini 3.6 Flash / DeepSeek V4 相互フォールバックAI解析 (ユーザー指定優先順)
 * 3. AI非接続時はローカルOCRルールベース推定
 */
export async function analyzeMealPhoto({
  base64Image,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl = SECURE_WORKER_PROXY_URL,
  preferredModel = 'gemini',
  onProgress
}) {
  let ocrResult = { text: '' };

  // Step 1: オンデバイスOCR実行
  try {
    if (onProgress) onProgress('オンデバイスOCRでラベル・画像をスキャン中...');
    ocrResult = await extractNutritionTextWithOCR(base64Image);
  } catch (ocrErr) {
    console.warn('Pre-OCR skip:', ocrErr);
  }

  // Step 2: Cloudflare Worker プロキシ利用
  if (workerProxyUrl) {
    try {
      if (onProgress) onProgress(`AIサーバー経由で食事・PFCバランスを解析中 (${preferredModel === 'deepseek' ? 'DeepSeek優先' : 'Gemini優先'})...`);
      return await analyzeNutritionWithWorkerProxy(base64Image, workerProxyUrl, ocrResult.text, preferredModel);
    } catch (proxyErr) {
      console.warn('Worker proxy failed, switching to direct API keys if present:', proxyErr);
    }
  }

  // 直打ちフォールバック (DeepSeek優先)
  if (preferredModel === 'deepseek') {
    if (deepSeekApiKey) {
      try {
        if (onProgress) onProgress('DeepSeek V4 で食事解析中...');
        return await analyzeNutritionWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text);
      } catch (deepSeekErr) {
        console.warn('DeepSeek API failed, fallbacking to Gemini:', deepSeekErr);
      }
    }
    if (geminiApiKey) {
      try {
        if (onProgress) onProgress('Gemini 3.6 Flash で食事解析中...');
        return await analyzeNutritionWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash', ocrResult.text);
      } catch (geminiErr) {
        console.warn('Gemini API failed:', geminiErr);
      }
    }
  } else {
    // 直打ちフォールバック (Gemini優先: デフォルト)
    if (geminiApiKey) {
      try {
        if (onProgress) onProgress('Gemini 3.6 Flash で食事解析中...');
        return await analyzeNutritionWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash', ocrResult.text);
      } catch (geminiErr) {
        console.warn('Gemini API failed, retrying with 2.5-flash:', geminiErr);
        try {
          return await analyzeNutritionWithGemini(base64Image, geminiApiKey, 'gemini-2.5-flash', ocrResult.text);
        } catch (err2) {
          console.warn('Gemini fallback failed:', err2);
        }
      }
    }
    if (deepSeekApiKey) {
      try {
        if (onProgress) onProgress('DeepSeek V4 で食事解析中...');
        return await analyzeNutritionWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text);
      } catch (deepSeekErr) {
        console.warn('DeepSeek API failed:', deepSeekErr);
      }
    }
  }

  // Step 3: オフラインローカルOCRフォールバック
  if (onProgress) onProgress('オフラインOCRルール解析で栄養表示を抽出中...');
  const fallbackData = parseNutritionOcrText(ocrResult.text);
  return fallbackData;
}

/**
 * チャット・自然言語入力から栄養データを解析・算出
 */
export async function analyzeMealTextWithAI({
  textInput,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl = SECURE_WORKER_PROXY_URL,
  preferredModel = 'gemini'
}) {
  if (!textInput || !textInput.trim()) {
    throw new Error('入力テキストが空です。');
  }

  const prompt = `
あなたは管理栄養士AIです。ユーザーが入力した食事の記述「${textInput}」から、食べた料理・食品の名称、推定カロリー(kcal)、タンパク質(g)、脂質(g)、炭水化物(g)、塩分相当量(g)、食物繊維(g)、およびワンポイントアドバイスを算出し、以下のJSON形式で返却してください。

【返却JSON形式】
{
  "mealName": "主たる料理名や構成食品",
  "calories": 650,
  "protein": 28.0,
  "fat": 18.5,
  "carbs": 82.0,
  "sodium": 2.2,
  "fiber": 5.2,
  "ingredients": ["主要食材1", "主要食材2"],
  "advice": "栄養アドバイスメッセージ"
}
`;

  // 1. Worker Proxy 経由のテキスト解析試行
  if (workerProxyUrl) {
    try {
      const cleanUrl = workerProxyUrl.replace(/\/$/, '') + '/api/analyze-nutrition-text';
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textInput, preferredModel })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.calories !== undefined) return data;
      }
    } catch (e) {
      console.warn('Worker proxy text analysis failed, falling back to direct API keys:', e);
    }
  }

  const callGeminiDirect = async () => {
    if (!geminiApiKey) return null;
    for (const model of ['gemini-3.6-flash', 'gemini-2.5-flash']) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
          })
        });
        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) return JSON.parse(rawText.trim());
        }
      } catch (e) {
        console.warn(`Gemini (${model}) text analysis error:`, e);
      }
    }
    return null;
  };

  const callDeepSeekDirect = async () => {
    if (!deepSeekApiKey) return null;
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepSeekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return JSON.parse(content.trim());
      }
    } catch (e) {
      console.warn('DeepSeek text analysis error:', e);
    }
    return null;
  };

  // 2 & 3. 優先モデルに応じた直打ちフォールバック順
  if (preferredModel === 'deepseek') {
    const dsRes = await callDeepSeekDirect();
    if (dsRes) return dsRes;
    const gemRes = await callGeminiDirect();
    if (gemRes) return gemRes;
  } else {
    const gemRes = await callGeminiDirect();
    if (gemRes) return gemRes;
    const dsRes = await callDeepSeekDirect();
    if (dsRes) return dsRes;
  }

  // 4. オフライン時／AI未接続時の簡易キーワード推定フォールバック
  const text = textInput.toLowerCase();
  let baseCal = 350;
  let baseP = 12;
  let baseF = 10;
  let baseC = 45;
  let baseSalt = 1.0;
  let baseFiber = 2.0;

  if (text.includes('ハンバーグ') || text.includes('肉') || text.includes('ステーキ') || text.includes('焼肉')) {
    baseCal += 300; baseP += 20; baseF += 20; baseSalt += 1.0; baseFiber += 0.5;
  }
  if (text.includes('ラーメン') || text.includes('パスタ') || text.includes('麺') || text.includes('うどん')) {
    baseCal += 250; baseC += 40; baseF += 8; baseSalt += 2.5; baseFiber += 1.5;
  }
  if (text.includes('サラダ') || text.includes('野菜')) {
    baseCal += 50; baseC += 5; baseFiber += 3.5;
  }
  if (text.includes('大盛り') || text.includes('メガ')) {
    baseCal = Math.round(baseCal * 1.4);
    baseP = Math.round(baseP * 1.3);
    baseF = Math.round(baseF * 1.3);
    baseC = Math.round(baseC * 1.4);
    baseFiber = Math.round(baseFiber * 1.3);
  }
  if (text.includes('小盛り') || text.includes('少なめ')) {
    baseCal = Math.round(baseCal * 0.7);
    baseP = Math.round(baseP * 0.7);
    baseF = Math.round(baseF * 0.7);
    baseC = Math.round(baseC * 0.7);
    baseFiber = Math.round(baseFiber * 0.7);
  }

  const words = textInput.split(/[\s,、]+/);
  return {
    mealName: textInput.substring(0, 30),
    calories: baseCal,
    protein: baseP,
    fat: baseF,
    carbs: baseC,
    sodium: Number(baseSalt.toFixed(1)),
    fiber: Number(baseFiber.toFixed(1)),
    ingredients: words,
    advice: 'オフライン推定結果です。AIプロキシ/APIキーを設定すると高精度な自動分析が可能です。'
  };
}

