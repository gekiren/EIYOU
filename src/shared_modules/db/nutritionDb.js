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
        this.dexieDb.version(2).stores({
          mealLogs: '++id, date, mealType, createdAt',
          foods: '++id, name, createdAt',
          userGoals: '++id, date',
          favorites: '++id, name, createdAt'
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

  async _getNativeFavorites() {
    const raw = await safeStorage.getItem('eiyou_favorites_v1', '[]');
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }

  async _saveNativeFavorites(favs) {
    await safeStorage.setItem('eiyou_favorites_v1', JSON.stringify(favs));
  }

  /**
   * お気に入りリストの取得
   */
  async getFavorites() {
    if (this.isWeb && this.dexieDb) {
      try {
        return await this.dexieDb.favorites.orderBy('createdAt').reverse().toArray();
      } catch (e) {
        console.warn('Dexie getFavorites error:', e);
      }
    }
    return await this._getNativeFavorites();
  }

  /**
   * お気に入りの追加・解除トグル
   */
  async toggleFavorite(mealData) {
    const nameToMatch = (mealData.name || '').trim().toLowerCase();
    if (!nameToMatch) return false;

    if (this.isWeb && this.dexieDb) {
      try {
        const existing = await this.dexieDb.favorites.where('name').equals(mealData.name).first();
        if (existing) {
          await this.dexieDb.favorites.delete(existing.id);
          return false; // 解除された
        } else {
          await this.dexieDb.favorites.add({
            name: mealData.name,
            mealType: mealData.mealType || 'lunch',
            calories: Number(mealData.calories) || 0,
            protein: Number(mealData.protein) || 0,
            fat: Number(mealData.fat) || 0,
            carbs: Number(mealData.carbs) || 0,
            sodium: Number(mealData.sodium) || 0,
            fiber: Number(mealData.fiber) || 0,
            photoUrl: mealData.photoUrl || '',
            memo: mealData.memo || '',
            createdAt: new Date().toISOString()
          });
          return true; // 登録された
        }
      } catch (e) {
        console.warn('Dexie toggleFavorite error:', e);
      }
    }

    const favs = await this._getNativeFavorites();
    const index = favs.findIndex((f) => (f.name || '').trim().toLowerCase() === nameToMatch);
    if (index !== -1) {
      favs.splice(index, 1);
      await this._saveNativeFavorites(favs);
      return false; // 解除された
    } else {
      favs.push({
        id: Date.now(),
        name: mealData.name,
        mealType: mealData.mealType || 'lunch',
        calories: Number(mealData.calories) || 0,
        protein: Number(mealData.protein) || 0,
        fat: Number(mealData.fat) || 0,
        carbs: Number(mealData.carbs) || 0,
        sodium: Number(mealData.sodium) || 0,
        fiber: Number(mealData.fiber) || 0,
        photoUrl: mealData.photoUrl || '',
        memo: mealData.memo || '',
        createdAt: new Date().toISOString()
      });
      await this._saveNativeFavorites(favs);
      return true; // 登録された
    }
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
      fiber: Number(mealData.fiber) || 0,
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
   * 食事ログの更新
   */
  async updateMealLog(id, updateData) {
    if (this.isWeb && this.dexieDb) {
      return await this.dexieDb.mealLogs.update(id, updateData);
    }
    const logs = await this._getNativeLogs();
    const index = logs.findIndex(item => item.id === id);
    if (index !== -1) {
      logs[index] = { ...logs[index], ...updateData };
      await this._saveNativeLogs(logs);
    }
  }

  /**
   * 全食事ログの取得
   */
  async getAllMealLogs() {
    if (this.isWeb && this.dexieDb) {
      try {
        return await this.dexieDb.mealLogs.orderBy('createdAt').reverse().toArray();
      } catch (e) {
        console.warn('Dexie getAllMealLogs error:', e);
      }
    }
    const logs = await this._getNativeLogs();
    if (!Array.isArray(logs)) return [];
    return logs.sort((a, b) => {
      const timeA = a && a.createdAt ? new Date(a.createdAt).getTime() : (a && a.id ? Number(a.id) : 0);
      const timeB = b && b.createdAt ? new Date(b.createdAt).getTime() : (b && b.id ? Number(b.id) : 0);
      const valA = isNaN(timeA) ? 0 : timeA;
      const valB = isNaN(timeB) ? 0 : timeB;
      return valB - valA;
    });
  }
}

export const nutritionDb = new HybridNutritionDb();
