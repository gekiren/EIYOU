import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Web / Native 両対応の抽象化ストレージモジュール
 */
class SafeStorage {
  constructor() {
    this.memoryStore = new Map();
    this.isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  /**
   * 同期的にキーを取得（初期値フォールバック用）
   */
  getItemSync(key, fallback = '') {
    if (this.isWeb) {
      try {
        const val = window.localStorage.getItem(key);
        return val !== null ? val : fallback;
      } catch (e) {
        return fallback;
      }
    }
    return this.memoryStore.has(key) ? this.memoryStore.get(key) : fallback;
  }

  /**
   * 非同期でキーを取得
   */
  async getItem(key, fallback = '') {
    if (this.isWeb) {
      return this.getItemSync(key, fallback);
    }
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) {
        this.memoryStore.set(key, val);
        return val;
      }
    } catch (e) {
      console.warn(`[SafeStorage] getItem error for ${key}:`, e);
    }
    return fallback;
  }

  /**
   * 非同期でキーに保存
   */
  async setItem(key, value) {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    this.memoryStore.set(key, stringVal);

    if (this.isWeb) {
      try {
        window.localStorage.setItem(key, stringVal);
      } catch (e) {
        console.warn(`[SafeStorage] localStorage setItem error for ${key}:`, e);
      }
      return;
    }

    try {
      await AsyncStorage.setItem(key, stringVal);
    } catch (e) {
      console.warn(`[SafeStorage] AsyncStorage setItem error for ${key}:`, e);
    }
  }

  /**
   * 非同期でキーを削除
   */
  async removeItem(key) {
    this.memoryStore.delete(key);
    if (this.isWeb) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {}
  }
}

export const safeStorage = new SafeStorage();
