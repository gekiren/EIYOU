import Dexie from 'dexie';
import { safeStorage } from '../storage/safeStorage.js';

const isIndexedDBSupported = typeof window !== 'undefined' && 'indexedDB' in window;

/**
 * 栄養管理アプリ用 ハイブリッドデータベース
 * Web: Dexie.js (IndexedDB)
 * Native: SafeStorage (AsyncStorage / Key-Value)
 */
class HybridNutritionDb {
  constructor() {
    this.isWeb = isIndexedDBSupported;
    if (this.isWeb) {
      try {
        this.dexieDb = new Dexie('NutritionAppDB');
        this.dexieDb.version(1).stores({
          mealLogs: '++id, date, mealType, createdAt',
          foods: '++id, name, createdAt',
          userGoals: '++id, date'
        });
      } catch (e) {
        console.warn('[HybridNutritionDb] Dexie init failed, falling back to safeStorage', e);
        this.isWeb = false;
      }
    }
  }

  async _getNativeLogs() {
    const raw = await safeStorage.getItem('eiyou_meal_logs_v1', '[]');
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }

  async _saveNativeLogs(logs) {
    await safeStorage.setItem('eiyou_meal_logs_v1', JSON.stringify(logs));
  }

  /**
   * 食事ログの新規登録
   */
  async addMealLog(mealData) {
    const logItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      date: mealData.date || new Date().toISOString().split('T')[0],
      mealType: mealData.mealType || 'lunch',
      name: mealData.name || '食事記録',
      calories: Number(mealData.calories) || 0,
      protein: Number(mealData.protein) || 0,
      fat: Number(mealData.fat) || 0,
      carbs: Number(mealData.carbs) || 0,
      sodium: Number(mealData.sodium) || 0,
      photoUrl: mealData.photoUrl || '',
      memo: mealData.memo || '',
      createdAt: new Date().toISOString()
    };

    if (this.isWeb && this.dexieDb) {
      const { id, ...rest } = logItem;
      return await this.dexieDb.mealLogs.add(rest);
    }

    const logs = await this._getNativeLogs();
    logs.push(logItem);
    await this._saveNativeLogs(logs);
    return logItem.id;
  }

  /**
   * 特定日付の食事ログ取得
   */
  async getMealLogsByDate(dateStr) {
    if (this.isWeb && this.dexieDb) {
      return await this.dexieDb.mealLogs.where('date').equals(dateStr).toArray();
    }
    const logs = await this._getNativeLogs();
    return logs.filter(item => item.date === dateStr);
  }

  /**
   * 食事ログの削除
   */
  async deleteMealLog(id) {
    if (this.isWeb && this.dexieDb) {
      return await this.dexieDb.mealLogs.delete(id);
    }
    const logs = await this._getNativeLogs();
    const filtered = logs.filter(item => item.id !== id);
    await this._saveNativeLogs(filtered);
  }

  /**
   * 全食事ログの取得
   */
  async getAllMealLogs() {
    if (this.isWeb && this.dexieDb) {
      return await this.dexieDb.mealLogs.orderBy('createdAt').reverse().toArray();
    }
    const logs = await this._getNativeLogs();
    return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

export const nutritionDb = new HybridNutritionDb();
