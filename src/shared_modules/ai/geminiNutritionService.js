import { validateAndNormalizeNutritionResult } from '../../types/nutritionTypes';

/**
 * Gemini 3.6 Flash API 直接呼出による栄養・食事解析モジュール
 */


/**
 * 食事・食品画像からPFCバランスおよび栄養成分をGemini 3.6 Flashで解析
 */
export async function analyzeNutritionWithGemini(
  base64Image,
  apiKey,
  modelName = 'gemini-3.6-flash',
  ocrHintText = '',
  thinkingMode = 'quick'
) {
  if (!apiKey) {
    throw new Error('Gemini APIキーが指定されていません。');
  }

  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const hintPrompt = ocrHintText ? `\n【参考：オンデバイスOCR事前抽出テキスト】\n${ocrHintText}\n` : '';
  const thinkingInstruction = thinkingMode === 'thinking'
    ? '\n【解析モード：思考あり (Thinking Mode)】\n食事の栄養成分、隠れた食材・調味料・調理法・量の割合について深く考察・推論した上で、最も正確な栄養計算結果を算出してください。\n'
    : '\n【解析モード：クイック (Quick Mode)】\n思考プロセスを最小限にし、迅速に結果を返却してください。\n';

  const prompt = `
あなたは優秀な管理栄養士およびAI画像解析エクスパートです。
提出された画像（食事の料理写真、または市販食品の栄養成分表示ラベル写真）を解析し、栄養成分情報をJSON形式で抽出・推定してください。
${thinkingInstruction}
画像が食品や料理、栄養成分表示ラベルではない場合（文字のみの文書、景色、人物の顔、機器など）は、
"isFood": false, "reason": "食品または栄養成分表示ラベルが検知できませんでした。" を返してください。

食品・料理・栄養成分表示ラベルの場合は "isFood": true としてください。
${hintPrompt}
【返却JSONフォーマット】
{
  "isFood": true,
  "mealName": "料理名または食品名",
  "calories": 450,        // 推定総エネルギー (kcal, 数値のみ)
  "protein": 25.5,        // タンパク質 (g, 数値のみ)
  "fat": 12.0,            // 脂質 (g, 数値のみ)
  "carbs": 55.0,          // 炭水化物 (g, 数値のみ)
  "sodium": 1.5,          // 食塩相当量 (g, 数値のみ, 不明な場合は0)
  "fiber": 4.5,           // 食物繊維 (g, 数値のみ, 不明な場合は0)
  "ingredients": ["推定される主な食材1", "食材2"],
  "advice": "栄養バランスに関する簡単なワンポイントアドバイス（50文字程度）"
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const genConfig = {
    responseMimeType: 'application/json',
    temperature: thinkingMode === 'thinking' ? 0.3 : 0.1,
  };
  if (thinkingMode === 'thinking') {
    genConfig.thinkingConfig = { thinkingBudget: 2048 };
  } else {
    genConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: cleanBase64 } }
        ]
      }],
      generationConfig: genConfig
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API通信エラー (${response.status})`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini APIからのレスポンス本文が空です。');

  return validateAndNormalizeNutritionResult(JSON.parse(rawText.trim()));
}
