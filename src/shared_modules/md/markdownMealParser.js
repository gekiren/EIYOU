/**
 * Markdown (MD) 形式テキストから食事データを自動抽出・構造化するパースユーティリティ
 */

// 食事種別の正規化
export function normalizeMealType(str) {
  if (!str) return 'lunch';
  const clean = String(str).replace(/[[\]]/g, '').trim().toLowerCase();
  if (clean.includes('朝') || clean.includes('breakfast')) return 'breakfast';
  if (clean.includes('昼') || clean.includes('lunch')) return 'lunch';
  if (clean.includes('夜') || clean.includes('夕') || clean.includes('dinner')) return 'dinner';
  if (clean.includes('間') || clean.includes('スナック') || clean.includes('snack')) return 'snack';
  return 'lunch';
}

// 日付文字列の正規化 (YYYY-MM-DD)
export function normalizeDateStr(str) {
  if (!str) return new Date().toISOString().split('T')[0];
  const match = String(str).match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().split('T')[0];
}

// 数値の安全なパース
function parseNum(val) {
  if (val === undefined || val === null) return 0;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * 1. Markdown テーブル形式のパース
 */
export function parseMarkdownTable(text, defaultDate = '') {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('|'));
  if (lines.length < 2) return [];

  // ヘッダー行と区切り行を探す
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('---') || lines[i].includes(':--')) {
      headerIdx = i - 1;
      break;
    }
  }

  if (headerIdx < 0 || headerIdx >= lines.length) {
    // 区切り線が見つからない場合、1行目をヘッダーと仮定
    headerIdx = 0;
  }

  const headers = lines[headerIdx]
    .split('|')
    .slice(1, -1)
    .map(h => h.trim().toLowerCase());

  // 各カラムの役割インデックスを判定
  const colMap = {
    date: headers.findIndex(h => h.includes('日付') || h.includes('date')),
    mealType: headers.findIndex(h => h.includes('分類') || h.includes('種別') || h.includes('タイプ') || h.includes('type')),
    name: headers.findIndex(h => h.includes('メニュー') || h.includes('名前') || h.includes('食事') || h.includes('項目') || h.includes('name')),
    calories: headers.findIndex(h => h.includes('カロリー') || h.includes('kcal') || h.includes('cal') || h.includes('エネルギー')),
    protein: headers.findIndex(h => h.includes('タンパク') || h.includes('たんぱく') || h.includes('p(g)') || h === 'p' || h.includes('protein')),
    fat: headers.findIndex(h => h.includes('脂質') || h.includes('f(g)') || h === 'f' || h.includes('fat')),
    carbs: headers.findIndex(h => h.includes('炭水化物') || h.includes('糖質') || h.includes('c(g)') || h === 'c' || h.includes('carb')),
    fiber: headers.findIndex(h => h.includes('食物繊維') || h.includes('繊維') || h.includes('fiber')),
    sodium: headers.findIndex(h => h.includes('塩分') || h.includes('食塩') || h.includes('塩') || h.includes('sodium') || h.includes('salt')),
    memo: headers.findIndex(h => h.includes('メモ') || h.includes('Note') || h.includes('memo') || h.includes('備考'))
  };

  const results = [];
  const startDataIdx = headerIdx + (lines[headerIdx + 1]?.includes('---') ? 2 : 1);

  for (let i = startDataIdx; i < lines.length; i++) {
    const cols = lines[i].split('|').slice(1, -1).map(c => c.trim());
    if (cols.length === 0) continue;

    const nameVal = colMap.name !== -1 ? cols[colMap.name] : (cols[1] || cols[0]);
    if (!nameVal || nameVal === '-' || nameVal.includes('記録なし')) continue;

    const dateVal = colMap.date !== -1 ? normalizeDateStr(cols[colMap.date]) : (defaultDate || normalizeDateStr(''));
    const typeVal = colMap.mealType !== -1 ? normalizeMealType(cols[colMap.mealType]) : 'lunch';
    const calories = colMap.calories !== -1 ? parseNum(cols[colMap.calories]) : 0;
    const protein = colMap.protein !== -1 ? parseNum(cols[colMap.protein]) : 0;
    const fat = colMap.fat !== -1 ? parseNum(cols[colMap.fat]) : 0;
    const carbs = colMap.carbs !== -1 ? parseNum(cols[colMap.carbs]) : 0;
    const fiber = colMap.fiber !== -1 ? parseNum(cols[colMap.fiber]) : 0;
    const sodium = colMap.sodium !== -1 ? parseNum(cols[colMap.sodium]) : 0;
    const memo = colMap.memo !== -1 ? (cols[colMap.memo] || '') : '';

    results.push({
      date: dateVal,
      mealType: typeVal,
      name: nameVal.replace(/\\\|/g, '|'),
      calories,
      protein,
      fat,
      carbs,
      fiber,
      sodium,
      memo: memo.replace(/\\\|/g, '|')
    });
  }

  return results;
}

/**
 * 2. Markdown リスト・キー/値 形式のパース
 */
export function parseMarkdownList(text, defaultDate = '') {
  const lines = text.split(/\r?\n/);
  const results = [];

  let currentDate = defaultDate || normalizeDateStr('');
  let currentMealType = 'lunch';
  let currentItem = null;

  const pushCurrentItem = () => {
    if (currentItem && currentItem.name) {
      results.push({ ...currentItem });
      currentItem = null;
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ヘッダー判定 (# 2026-08-04 朝食 など)
    if (trimmed.startsWith('#')) {
      pushCurrentItem();
      const dateMatch = trimmed.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);
      if (dateMatch) currentDate = normalizeDateStr(dateMatch[1]);
      if (trimmed.includes('朝')) currentMealType = 'breakfast';
      else if (trimmed.includes('昼')) currentMealType = 'lunch';
      else if (trimmed.includes('夕') || trimmed.includes('夜')) currentMealType = 'dinner';
      else if (trimmed.includes('間')) currentMealType = 'snack';
      continue;
    }

    // 箇条書き判定
    const listContent = trimmed.replace(/^[-*+]\s+/, '').replace(/^\[[ xX]\]\s+/, '');

    // キー: 値 の判定
    const kvMatch = listContent.match(/^([^:：]+)[:：]\s*(.+)$/);

    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase();
      const val = kvMatch[2].trim();

      if (key.includes('食事名') || key.includes('メニュー') || key.includes('名前') || key.includes('料理')) {
        pushCurrentItem();
        currentItem = {
          date: currentDate,
          mealType: currentMealType,
          name: val,
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          fiber: 0,
          sodium: 0,
          memo: ''
        };
        continue;
      }

      if (!currentItem) {
        // 食事名キーがない場合、最初のキー:値が「朝食: サケ定食」のような形式の可能性がある
        const typeCandidate = normalizeMealType(key);
        if (key.includes('朝') || key.includes('昼') || key.includes('夕') || key.includes('夜') || key.includes('間')) {
          pushCurrentItem();
          currentItem = {
            date: currentDate,
            mealType: typeCandidate,
            name: val.replace(/\s*\([^)]*\)/, ''), // カッコ内除去
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            fiber: 0,
            sodium: 0,
            memo: ''
          };

          // カッコ内のインライン数値抽出 (例: (550kcal, P:28g, F:18g, C:65g))
          const inlineMatch = val.match(/\(([^)]+)\)/);
          if (inlineMatch) {
            parseInlineNutrients(inlineMatch[1], currentItem);
          }
          continue;
        }
      }

      if (currentItem) {
        if (key.includes('カロリー') || key.includes('kcal') || key.includes('エネルギー')) {
          currentItem.calories = parseNum(val);
        } else if (key.includes('タンパク') || key.includes('たんぱく') || key === 'p' || key.includes('protein')) {
          currentItem.protein = parseNum(val);
        } else if (key.includes('脂質') || key === 'f' || key.includes('fat')) {
          currentItem.fat = parseNum(val);
        } else if (key.includes('炭水化物') || key.includes('糖質') || key === 'c' || key.includes('carb')) {
          currentItem.carbs = parseNum(val);
        } else if (key.includes('食物繊維') || key.includes('繊維') || key.includes('fiber')) {
          currentItem.fiber = parseNum(val);
        } else if (key.includes('塩分') || key.includes('食塩') || key.includes('塩') || key.includes('sodium') || key.includes('salt')) {
          currentItem.sodium = parseNum(val);
        } else if (key.includes('メモ') || key.includes('備考')) {
          currentItem.memo = val;
        }
      }
    }
  }

  pushCurrentItem();
  return results;
}

// カッコ内の「550kcal / P:28g / F:18g / C:65g」などの文字から栄養価を直接セットする補助関数
function parseInlineNutrients(str, target) {
  const parts = str.split(/[/,;,\s]+/);
  for (let part of parts) {
    const p = part.trim();
    if (/(\d+)\s*kcal/i.test(p)) {
      target.calories = parseNum(p);
    } else if (/p[:：]?\s*(\d+(?:\.\d+)?)/i.test(p)) {
      target.protein = parseNum(p);
    } else if (/f[:：]?\s*(\d+(?:\.\d+)?)/i.test(p)) {
      target.fat = parseNum(p);
    } else if (/c[:：]?\s*(\d+(?:\.\d+)?)/i.test(p)) {
      target.carbs = parseNum(p);
    } else if (/(fiber|繊維)[:：]?\s*(\d+(?:\.\d+)?)/i.test(p)) {
      target.fiber = parseNum(p);
    } else if (/(salt|塩分|塩)[:：]?\s*(\d+(?:\.\d+)?)/i.test(p)) {
      target.sodium = parseNum(p);
    }
  }
}

/**
 * 総合パース関数（テーブル・リスト双方を自動試行）
 */
export function parseMealMarkdown(text, defaultDate = '') {
  if (!text || typeof text !== 'string') return [];

  const trimmed = text.trim();

  // 1. テーブル形式の試行
  if (trimmed.includes('|') && trimmed.includes('\n')) {
    const tableResults = parseMarkdownTable(trimmed, defaultDate);
    if (tableResults.length > 0) return tableResults;
  }

  // 2. リスト・キー/値 形式の試行
  const listResults = parseMarkdownList(trimmed, defaultDate);
  if (listResults.length > 0) return listResults;

  return [];
}
