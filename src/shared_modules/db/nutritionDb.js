import Dexie from 'dexie';

/**
 * 栄養管理アプリ用 Dexie.js (IndexedDB) スキーマ定義
 */
export class NutritionDatabase extends Dexie {
  constructor() {
    super('NutritionAppDB');

    this.version(1).stores({
      // 食事ログ: ID, 日付 (YYYY-MM-DD), 食事種別 (breakfast, lunch, dinner, snack), 登録日時
      mealLogs: '++id, date, mealType, createdAt',
      // カスタム食品マスター: ID, 食品名, 登録日時
      foods: '++id, name, createdAt',
      // 日別目標値: 日付またはID
      userGoals: '++id, date'
    });
  }

  /**
   * 食事ログの新規登録
   */
  async addMealLog(mealData) {
    return await this.mealLogs.add({
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
    });
  }

  /**
   * 特定日付の食事ログ取得
   */
  async getMealLogsByDate(dateStr) {
    return await this.mealLogs.where('date').equals(dateStr).toArray();
  }

  /**
   * 食事ログの削除
   */
  async deleteMealLog(id) {
    return await this.mealLogs.delete(id);
  }

  /**
   * 全食事ログの取得
   */
  async getAllMealLogs() {
    return await this.mealLogs.orderBy('createdAt').reverse().toArray();
  }
}

export const nutritionDb = new NutritionDatabase();
