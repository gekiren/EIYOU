import * as FileSystem from 'expo-file-system';

const PHOTO_DIR = `${FileSystem.documentDirectory}meal_photos/`;

/**
 * 写真保存用ディレクトリの確保
 */
async function ensurePhotoDirExists() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('[PhotoStorage] Failed to create photo directory:', error);
  }
}

/**
 * 食事写真ストレージサービス
 */
export const photoStorageService = {
  /**
   * 一時URIまたはBase64などの画像データをローカル永続ファイルとして保存
   * @param {string} sourceUri - キャッシュ/一時 URI または base64 データ
   * @returns {Promise<string>} - 保存されたローカルファイル URI (file:///...)
   */
  async savePhoto(sourceUri) {
    if (!sourceUri) return '';

    // すでに meal_photos に保存済みの場合はそのまま返す
    if (sourceUri.includes('meal_photos/')) {
      return sourceUri;
    }

    try {
      await ensurePhotoDirExists();

      const filename = `meal_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
      const targetPath = `${PHOTO_DIR}${filename}`;

      if (sourceUri.startsWith('data:image/')) {
        // Base64 形式の場合はファイルとして書き出し
        const base64Data = sourceUri.split(',')[1];
        await FileSystem.writeAsStringAsync(targetPath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        // 一時 URI (file:///... または content://...) からコピー
        await FileSystem.copyAsync({
          from: sourceUri,
          to: targetPath,
        });
      }

      console.log('[PhotoStorage] Photo saved to:', targetPath);
      return targetPath;
    } catch (error) {
      console.warn('[PhotoStorage] Failed to save photo locally, returning original URI:', error);
      return sourceUri;
    }
  },

  /**
   * 不要になった写真ファイルをローカルストレージから削除
   * @param {string} photoUri - 削除対象のファイル URI
   */
  async deletePhoto(photoUri) {
    if (!photoUri || !photoUri.includes('meal_photos/')) {
      return; // 自前で保存した写真以外は削除しない
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(photoUri, { idempotent: true });
        console.log('[PhotoStorage] Photo deleted:', photoUri);
      }
    } catch (error) {
      console.warn('[PhotoStorage] Failed to delete photo file:', error);
    }
  }
};
