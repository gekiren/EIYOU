import * as FileSystem from 'expo-file-system';
import { safeStorage } from '../storage/safeStorage.js';
import { nutritionDb } from '../db/nutritionDb.js';

// ファイル名・パス用サニタイズ関数
export function sanitizeFileName(name) {
  if (!name) return '';
  return String(name).replace(/[/\\?%*:|"<>]/g, '').trim();
}

/**
 * Obsidian 連携サービス
 */
class ObsidianSyncService {
  constructor() {
    this.STORAGE_KEY_CONFIG = 'eiyou_obsidian_config_v1';
  }

  /**
   * 設定を取得
   */
  async getConfig() {
    const raw = await safeStorage.getItem(this.STORAGE_KEY_CONFIG, '');
    const defaultConfig = {
      enabled: false,
      vaultUri: '',
      saveMode: 'dedicated', // 'dedicated' | 'append' | 'individual'
      folderName: 'EIYOU',
      autoSyncOnLaunch: true
    };
    if (!raw) return defaultConfig;
    try {
      return { ...defaultConfig, ...JSON.parse(raw) };
    } catch (e) {
      return defaultConfig;
    }
  }

  /**
   * 設定を保存
   */
  async saveConfig(config) {
    const current = await this.getConfig();
    const newConfig = { ...current, ...config };
    await safeStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(newConfig));
    return newConfig;
  }

  /**
   * 食事タイプラベルを WikiLink 用にフォーマット
   */
  _getMealTypeWikiLink(mealType) {
    const map = {
      breakfast: '[[朝食]]',
      lunch: '[[昼食]]',
      dinner: '[[夕食]]',
      snack: '[[間食]]'
    };
    return map[mealType] || `[[${mealType || '食事'}]]`;
  }

  /**
   * 特定日付の食事ログ一覧から Markdown コンテンツを生成
   */
  generateMarkdownForDate(dateStr, mealLogs, userGoals = {}) {
    const safeDate = sanitizeFileName(dateStr);
    const totals = mealLogs.reduce((acc, item) => {
      acc.calories += Number(item.calories) || 0;
      acc.protein += Number(item.protein) || 0;
      acc.fat += Number(item.fat) || 0;
      acc.carbs += Number(item.carbs) || 0;
      acc.sodium += Number(item.sodium) || 0;
      acc.fiber += Number(item.fiber) || 0;
      return acc;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0, fiber: 0 });

    const goalCal = userGoals.calories || 2200;
    const goalP = userGoals.protein || 75;
    const goalF = userGoals.fat || 60;
    const goalC = userGoals.carbs || 280;
    const goalS = userGoals.sodium || 7.0;
    const goalFi = userGoals.fiber || 20.0;

    let md = `---
title: "EIYOU Meal Log - ${safeDate}"
date: ${safeDate}
type: nutrition_log
tags:
  - nutrition
  - eiyou
  - health
---

# 📱 [EIYOU] 栄養記録 - ${safeDate}

## 📊 栄養摂取サマリー
- **総カロリー**: ${totals.calories.toFixed(0)} kcal / ${goalCal} kcal
- **タンパク質**: ${totals.protein.toFixed(1)}g / ${goalP}g [[PFCバランス]]
- **脂質**: ${totals.fat.toFixed(1)}g / ${goalF}g
- **炭水化物**: ${totals.carbs.toFixed(1)}g / ${goalC}g
- **塩分**: ${totals.sodium.toFixed(1)}g / ${goalS}g
- **食物繊維**: ${totals.fiber.toFixed(1)}g / ${goalFi}g

## 🥗 食事ログ一覧
| 分類 | メニュー名 | カロリー(kcal) | P(g) | F(g) | C(g) | 塩分(g) | 食物繊維(g) | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;

    if (mealLogs.length === 0) {
      md += `| - | 記録なし | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | - |\n`;
    } else {
      mealLogs.forEach(log => {
        const typeLink = this._getMealTypeWikiLink(log.mealType);
        const name = (log.name || '食事記録').replace(/\|/g, '\\|');
        const memo = (log.memo || '-').replace(/\|/g, '\\|');
        md += `| ${typeLink} | ${name} | ${log.calories || 0} | ${(log.protein || 0).toFixed(1)} | ${(log.fat || 0).toFixed(1)} | ${(log.carbs || 0).toFixed(1)} | ${(log.sodium || 0).toFixed(1)} | ${(log.fiber || 0).toFixed(1)} | ${memo} |\n`;
      });
    }

    md += `\n---\n*Updated via [[EIYOU]] Nutrition App*\n`;
    return md;
  }

  /**
   * 全食事ログから単一の個別ノート (individual mode) 用 Markdown を生成
   */
  generateIndividualMarkdown(allLogs, userGoals = {}) {
    let md = `---
title: "EIYOU All Nutrition History"
date: ${new Date().toISOString().split('T')[0]}
type: nutrition_history
tags:
  - nutrition
  - eiyou
  - history
---

# 📱 [EIYOU] 全栄養記録履歴 [[栄養管理]]

## 🥗 全食事ログ一覧
| 日付 | 分類 | メニュー名 | カロリー(kcal) | P(g) | F(g) | C(g) | 塩分(g) | 食物繊維(g) | メモ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;

    if (allLogs.length === 0) {
      md += `| - | - | 記録なし | 0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | - |\n`;
    } else {
      allLogs.forEach(log => {
        const typeLink = this._getMealTypeWikiLink(log.mealType);
        const name = (log.name || '食事記録').replace(/\|/g, '\\|');
        const memo = (log.memo || '-').replace(/\|/g, '\\|');
        md += `| ${log.date || '-'} | ${typeLink} | ${name} | ${log.calories || 0} | ${(log.protein || 0).toFixed(1)} | ${(log.fat || 0).toFixed(1)} | ${(log.carbs || 0).toFixed(1)} | ${(log.sodium || 0).toFixed(1)} | ${(log.fiber || 0).toFixed(1)} | ${memo} |\n`;
      });
    }

    md += `\n---\n*Updated via [[EIYOU]] App*\n`;
    return md;
  }

  /**
   * デイリーノート追記用のセクションブロックを作成
   */
  generateDailyAppendSection(dateStr, mealLogs) {
    const safeDate = sanitizeFileName(dateStr);
    const totals = mealLogs.reduce((acc, item) => {
      acc.calories += Number(item.calories) || 0;
      acc.protein += Number(item.protein) || 0;
      acc.fat += Number(item.fat) || 0;
      acc.carbs += Number(item.carbs) || 0;
      acc.sodium += Number(item.sodium) || 0;
      acc.fiber += Number(item.fiber) || 0;
      return acc;
    }, { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0, fiber: 0 });

    let section = `## 📱 [EIYOU] Log (${safeDate})\n`;
    section += `* **摂取合計**: ${totals.calories.toFixed(0)} kcal (P: ${totals.protein.toFixed(1)}g / F: ${totals.fat.toFixed(1)}g / C: ${totals.carbs.toFixed(1)}g / Salt: ${totals.sodium.toFixed(1)}g / Fiber: ${totals.fiber.toFixed(1)}g) [[PFCバランス]]\n`;
    section += `| 分類 | メニュー | kcal | P(g) | F(g) | C(g) | 塩分(g) | 繊維(g) |\n`;
    section += `| --- | --- | --- | --- | --- | --- | --- | --- |\n`;

    mealLogs.forEach(log => {
      const typeLink = this._getMealTypeWikiLink(log.mealType);
      const name = (log.name || '食事記録').replace(/\|/g, '\\|');
      section += `| ${typeLink} | ${name} | ${log.calories || 0} | ${(log.protein || 0).toFixed(1)} | ${(log.fat || 0).toFixed(1)} | ${(log.carbs || 0).toFixed(1)} | ${(log.sodium || 0).toFixed(1)} | ${(log.fiber || 0).toFixed(1)} |\n`;
    });
    section += `\n`;
    return section;
  }

  /**
   * 既存のデイリーノート文字列にセクションを重複なく組み込む（置換または追記）
   */
  mergeDailyAppendContent(existingContent, dateStr, mealLogs) {
    const sectionHeader = `## 📱 [EIYOU] Log (${sanitizeFileName(dateStr)})`;
    const newSection = this.generateDailyAppendSection(dateStr, mealLogs);

    if (!existingContent) {
      return newSection;
    }

    if (existingContent.includes(sectionHeader)) {
      const headerIndex = existingContent.indexOf(sectionHeader);
      const nextHeaderIndex = existingContent.indexOf('\n## ', headerIndex + sectionHeader.length);
      if (nextHeaderIndex !== -1) {
        return (
          existingContent.substring(0, headerIndex) +
          newSection +
          existingContent.substring(nextHeaderIndex + 1)
        );
      } else {
        return existingContent.substring(0, headerIndex) + newSection;
      }
    } else {
      return existingContent.trimEnd() + '\n\n' + newSection;
    }
  }

  /**
   * 単一または特定日付のログを Obsidian Vault へ書き出し
   */
  async syncDateLogs(dateStr, userGoals = {}) {
    const config = await this.getConfig();
    if (!config.enabled) return { success: false, reason: 'disabled', message: 'Obsidian連携が無効です。' };

    const logs = await nutritionDb.getMealLogsByDate(dateStr);
    const safeFolderName = sanitizeFileName(config.folderName) || 'EIYOU';
    const safeDate = sanitizeFileName(dateStr);

    let fileName = '';
    let content = '';

    if (config.saveMode === 'dedicated') {
      fileName = `${safeFolderName}/EIYOU_${safeDate}.md`;
      content = this.generateMarkdownForDate(dateStr, logs, userGoals);
    } else if (config.saveMode === 'append') {
      fileName = `Daily/${safeDate}.md`;
      content = this.generateDailyAppendSection(dateStr, logs);
    } else if (config.saveMode === 'individual') {
      const allLogs = await nutritionDb.getAllMealLogs();
      fileName = `${safeFolderName}/EIYOU_Nutrition_Log.md`;
      content = this.generateIndividualMarkdown(allLogs, userGoals);
    }

    const meta = {
      isAppendMode: config.saveMode === 'append',
      dateStr,
      mealLogs: logs
    };

    return await this._writeFileToVault(fileName, content, config, meta);
  }

  /**
   * 全日付のログを Obsidian Vault へ一括エクスポート
   */
  async syncAllMealLogs(userGoals = {}) {
    const config = await this.getConfig();
    if (!config.enabled) return { success: false, reason: 'disabled', message: 'Obsidian連携が無効です。' };

    const allLogs = await nutritionDb.getAllMealLogs();
    if (config.saveMode === 'individual') {
      const safeFolderName = sanitizeFileName(config.folderName) || 'EIYOU';
      const fileName = `${safeFolderName}/EIYOU_Nutrition_Log.md`;
      const content = this.generateIndividualMarkdown(allLogs, userGoals);
      return await this._writeFileToVault(fileName, content, config);
    }

    // 日付ごとにグループ化して同期
    const logsByDate = {};
    allLogs.forEach(log => {
      const d = log.date || new Date().toISOString().split('T')[0];
      if (!logsByDate[d]) logsByDate[d] = [];
      logsByDate[d].push(log);
    });

    let count = 0;
    const dates = Object.keys(logsByDate);
    for (const d of dates) {
      const res = await this.syncDateLogs(d, userGoals);
      if (res.success) count++;
    }

    return {
      success: true,
      count,
      totalDates: dates.length,
      message: `Obsidianへ${count}/${dates.length}日分の記録を同期しました。`
    };
  }

  /**
   * 物理ストレージへの書き込み抽象化（Web / Native / SAF / Fallback）
   */
  async _writeFileToVault(relativePath, content, config, meta = {}) {
    const safePath = relativePath.split('/').map(sanitizeFileName).join('/');

    // 1. React Native / Expo (StorageAccessFramework SAF)
    const StorageAccessFramework = FileSystem.StorageAccessFramework || (typeof window !== 'undefined' && window.expoFileSystemSAF?.StorageAccessFramework);
    if (StorageAccessFramework && config.vaultUri) {
      try {
        const vaultUri = config.vaultUri;
        const pathParts = safePath.split('/');
        const fileName = pathParts.pop();
        let targetDirUri = vaultUri;

        // サブフォルダ作成/取得
        if (pathParts.length > 0) {
          const subDirName = pathParts.join('/');
          try {
            targetDirUri = await StorageAccessFramework.createDirectoryAsync(vaultUri, subDirName);
          } catch (e) {
            targetDirUri = vaultUri; // フォールバック
          }
        }

        // ディレクトリ内の既存ファイル一覧を取得して同名ファイルを検索
        let fileUri = null;
        let existingContent = '';
        try {
          const existingFiles = await StorageAccessFramework.readDirectoryAsync(targetDirUri);
          if (Array.isArray(existingFiles)) {
            const foundUri = existingFiles.find(uri => {
              const decoded = decodeURIComponent(uri);
              return (
                decoded.endsWith('/' + fileName) ||
                decoded.endsWith('%2F' + fileName) ||
                uri.endsWith('/' + encodeURIComponent(fileName))
              );
            });
            if (foundUri) {
              fileUri = foundUri;
              if (meta.isAppendMode) {
                try {
                  existingContent = await StorageAccessFramework.readAsStringAsync(foundUri, { encoding: 'utf8' });
                } catch (readErr) {
                  console.warn('[ObsidianSync] Failed to read existing daily note:', readErr);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[ObsidianSync] Directory search for existing file failed:', e);
        }

        // append モードで既存ノートがある場合は内容を統合
        let finalContent = content;
        if (meta.isAppendMode && meta.dateStr) {
          finalContent = this.mergeDailyAppendContent(existingContent, meta.dateStr, meta.mealLogs || []);
        }

        // 同名ファイルが存在しない場合のみ新規作成
        if (!fileUri) {
          fileUri = await StorageAccessFramework.createFileAsync(targetDirUri, fileName, 'text/markdown');
        }

        await StorageAccessFramework.writeAsStringAsync(fileUri, finalContent, { encoding: 'utf8' });
        return { success: true, path: safePath, target: 'SAF', message: `Obsidian Vault に [${fileName}] を保存しました。` };
      } catch (err) {
        console.warn('[ObsidianSync] SAF write failed, falling back', err);
      }
    }

    // 2. Web File System Access API (showDirectoryPicker ディレクトリハンドル保持時)
    if (typeof window !== 'undefined' && window.obsidianDirectoryHandle) {
      try {
        const handle = window.obsidianDirectoryHandle;
        const pathParts = safePath.split('/');
        const fileName = pathParts.pop();
        let currentDir = handle;

        for (const part of pathParts) {
          if (part) {
            try {
              currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            } catch (e) {
              console.warn(`Failed to create/get dir ${part}, fallback to vault root`);
              currentDir = handle;
            }
          }
        }

        const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return { success: true, path: safePath, target: 'FileSystemAccess' };
      } catch (err) {
        console.warn('[ObsidianSync] Web File System Access API failed', err);
      }
    }

    // 3. ブラウザ自動ダウンロード / Web フォールバック
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const fileNameOnly = safePath.split('/').pop();
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileNameOnly;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, path: safePath, target: 'WebDownload' };
      } catch (e) {
        console.error('[ObsidianSync] Web download fallback error', e);
      }
    }

    return { success: false, reason: 'Storage access not supported' };
  }
}

export const obsidianSyncService = new ObsidianSyncService();
