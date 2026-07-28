import { nutritionDb } from '../db/nutritionDb';

/**
 * 食事ログをCSVフォーマットテキストに変換
 */
export function convertMealLogsToCSV(logs) {
  const headers = ['ID', '日付', '区分', '食事名', 'カロリー(kcal)', 'タンパク質(g)', '脂質(g)', '炭水化物(g)', '登録日時'];
  const rows = logs.map(log => [
    log.id || '',
    `"${(log.date || '').replace(/"/g, '""')}"`,
    `"${(log.mealType || '').replace(/"/g, '""')}"`,
    `"${(log.name || '').replace(/"/g, '""')}"`,
    log.calories || 0,
    log.protein || 0,
    log.fat || 0,
    log.carbs || 0,
    `"${(log.createdAt || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * 食事ログのCSVエクスポート ＆ 自動ダウンロード発火
 */
export async function exportMealsToCSV() {
  const logs = await nutritionDb.getAllMealLogs();
  const csvContent = '\uFEFF' + convertMealLogsToCSV(logs); // BOM付与

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const now = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `nutrition_meal_logs_${now}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * CSVファイルから食事ログを読み込んでDBに復元・インポート
 */
export async function importMealsFromCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

        if (lines.length <= 1) {
          resolve(0);
          return;
        }

        let importedCount = 0;
        // 先頭ヘッダーをスキップ
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 8) {
            await nutritionDb.addMealLog({
              date: cols[1],
              mealType: cols[2],
              name: cols[3],
              calories: Number(cols[4]) || 0,
              protein: Number(cols[5]) || 0,
              fat: Number(cols[6]) || 0,
              carbs: Number(cols[7]) || 0,
            });
            importedCount++;
          }
        }
        resolve(importedCount);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}
