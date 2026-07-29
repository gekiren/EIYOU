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
export async function analyzeNutritionWithWorkerProxy(base64Image, proxyUrl, ocrHintText = '') {
  const cleanUrl = proxyUrl.replace(/\/$/, '') + '/api/analyze-nutrition';

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, ocrHintText })
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
 * 2. Workerプロキシ / Gemini 3.6 Flash / DeepSeek V4 相互フォールバックAI解析
 * 3. AI非接続時はローカルOCRルールベース推定
 */
export async function analyzeMealPhoto({
  base64Image,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl = SECURE_WORKER_PROXY_URL,
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
      if (onProgress) onProgress('AIサーバー経由で食事・PFCバランスを解析中...');
      return await analyzeNutritionWithWorkerProxy(base64Image, workerProxyUrl, ocrResult.text);
    } catch (proxyErr) {
      console.warn('Worker proxy failed, switching to direct API keys if present:', proxyErr);
    }
  }

  // Gemini 3.6 Flash 直打ち
  if (geminiApiKey) {
    try {
      if (onProgress) onProgress('Gemini 3.6 Flash で食事解析中...');
      return await analyzeNutritionWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash', ocrResult.text);
    } catch (geminiErr) {
      console.warn('Gemini API failed:', geminiErr);
    }
  }

  // DeepSeek V4 直打ち
  if (deepSeekApiKey) {
    try {
      if (onProgress) onProgress('DeepSeek V4 で食事解析中...');
      return await analyzeNutritionWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text);
    } catch (deepSeekErr) {
      console.warn('DeepSeek API failed:', deepSeekErr);
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
  deepSeekApiKey
}) {
  if (!textInput || !textInput.trim()) {
    throw new Error('入力テキストが空です。');
  }

  const prompt = `
あなたは管理栄養士AIです。ユーザーが入力した食事の記述「${textInput}」から、食べた料理・食品の名称、推定カロリー(kcal)、タンパク質(g)、脂質(g)、炭水化物(g)、塩分相当量(g)、およびワンポイントアドバイスを算出し、以下のJSON形式で返却してください。

【返却JSON形式】
{
  "mealName": "主たる料理名や構成食品",
  "calories": 650,
  "protein": 28.0,
  "fat": 18.5,
  "carbs": 82.0,
  "sodium": 2.2,
  "ingredients": ["主要食材1", "主要食材2"],
  "advice": "栄養アドバイスメッセージ"
}
`;

  // Gemini 3.6 Flash 直接呼出
  if (geminiApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;
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
      console.warn('Gemini text analysis error:', e);
    }
  }

  // DeepSeek 直接呼出
  if (deepSeekApiKey) {
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
  }

  // フォールバック（オフライン・近似値推定）
  const words = textInput.split(/[\s,、]+/);
  return {
    mealName: textInput.substring(0, 30),
    calories: 450,
    protein: 18.0,
    fat: 12.0,
    carbs: 60.0,
    sodium: 1.5,
    ingredients: words,
    advice: 'オフライン簡易推定です。APIキーを登録するとより精度の高いAI解析が可能です。'
  };
}

