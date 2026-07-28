/**
 * Cloudflare Worker 用 セキュアAIプロキシサーバー
 * Gemini 3.6 Flash / DeepSeek V4 APIキーの隠蔽 & 自動フォールバック処理
 */

export default {
  async fetch(request, env) {
    // CORS対応ヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ヘルスチェック
    if (url.pathname === '/' || url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'Nutrition & AI Proxy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 栄養解析エンドポイント
    if (url.pathname === '/api/analyze-nutrition' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { image, ocrHintText } = body;

        if (!image) {
          return new Response(JSON.stringify({ error: '画像データ(image)がありません。' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Gemini 3.6 Flash API 呼出
        const geminiKey = env.GEMINI_API_KEY;
        if (geminiKey) {
          try {
            const result = await callGeminiNutrition(image, geminiKey, ocrHintText);
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (geminiErr) {
            console.error('Gemini error in Worker, fallbacking to DeepSeek:', geminiErr);
          }
        }

        // DeepSeek API 呼出（フォールバック）
        const deepseekKey = env.DEEPSEEK_API_KEY;
        if (deepseekKey) {
          const result = await callDeepSeekNutrition(image, deepseekKey, ocrHintText);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: '利用可能なAI APIキーが環境変数に設定されていません。' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

async function callGeminiNutrition(base64Image, apiKey, ocrHintText = '') {
  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const prompt = `
提出された画像（食事の写真、または栄養成分表示ラベルの写真）から栄養価を推定・抽出してJSONで返却してください。
【返却JSON】
{
  "isFood": true,
  "mealName": "料理名または食品名",
  "calories": 450,
  "protein": 25.5,
  "fat": 12.0,
  "carbs": 55.0,
  "sodium": 1.5,
  "ingredients": ["成分1", "成分2"],
  "advice": "ワンポイントアドバイス"
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
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
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    })
  });

  if (!response.ok) throw new Error(`Gemini API Http ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

async function callDeepSeekNutrition(base64Image, apiKey, ocrHintText = '') {
  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const prompt = `
食事または栄養成分表示の画像から栄養数値をJSONで返してください。
{ "isFood": true, "mealName": "食品名", "calories": 450, "protein": 25.5, "fat": 12.0, "carbs": 55.0, "sodium": 1.5, "ingredients": [], "advice": "" }
`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
        ]
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  if (!response.ok) throw new Error(`DeepSeek API Http ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content);
}
