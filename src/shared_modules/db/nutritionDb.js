import { safeStorage } from '../storage/safeStorage.js';
import { photoStorageService } from '../storage/photoStorageService.js';

/**
 * 栄養管理アプリ用 ストレージデータベース (Native SafeStorage 一本化)
 * AsyncStorage / SafeStorage による超軽量・安全なローカル永続化
 */
class NutritionDb {
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
    return await this._getNativeFavorites();
  }

  /**
   * お気に入りの追加・解除トグル
   */
  async toggleFavorite(mealData) {
    const nameToMatch = (mealData.name || '').trim().toLowerCase();
    if (!nameToMatch) return false;

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

    const logs = await this._getNativeLogs();
    logs.push(logItem);
    await this._saveNativeLogs(logs);
    return logItem.id;
  }

  /**
   * 特定日付の食事ログ取得
   */
  async getMealLogsByDate(dateStr) {
    const logs = await this._getNativeLogs();
    return logs.filter(item => item.date === dateStr);
  }

  /**
   * 食事ログの削除（連動写真ファイルの自動削除含む）
   */
  async deleteMealLog(id) {
    const logs = await this._getNativeLogs();
    const targetLog = logs.find(item => item.id === id);
    if (targetLog && targetLog.photoUrl) {
      // 登録されていたローカル写真ファイルを削除
      await photoStorageService.deletePhoto(targetLog.photoUrl);
    }
    const filtered = logs.filter(item => item.id !== id);
    await this._saveNativeLogs(filtered);
  }

  /**
   * 食事ログの更新
   */
  async updateMealLog(id, updateData) {
    const logs = await this._getNativeLogs();
    const index = logs.findIndex(item => item.id === id);
    if (index !== -1) {
      const oldPhoto = logs[index].photoUrl;
      if (oldPhoto && updateData.photoUrl && oldPhoto !== updateData.photoUrl) {
        await photoStorageService.deletePhoto(oldPhoto);
      }
      logs[index] = { ...logs[index], ...updateData };
      await this._saveNativeLogs(logs);
    }
  }

  /**
   * 全食事ログの取得
   */
  async getAllMealLogs() {
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

export const nutritionDb = new NutritionDb();

