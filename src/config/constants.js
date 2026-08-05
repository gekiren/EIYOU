/**
 * EIYOU アプリケーション固定設定値
 * Cloudflare Worker プロキシ URL などの秘匿設定をアプリ側に完全固定し、
 * ユーザーが変更・参照できないようにカプセル化します。
 */

// 正しい Cloudflare Worker プロキシ URL
export const SECURE_WORKER_PROXY_URL = 'https://eiyou-ai-proxy.toshi-diyil.workers.dev';

/**
 * AsyncStorage / ローカルストレージキー一元定義
 */
export const STORAGE_KEYS = {
  MEAL_LOGS: 'eiyou_meal_logs_v1',
  FAVORITES: 'eiyou_favorites_v1',
  USER_GOALS: 'eiyou_user_goals',
  AI_MODEL: 'eiyou_preferred_ai_model',
  AI_THINKING_MODE: 'eiyou_ai_thinking_mode',
  AI_SETTINGS: 'eiyou_ai_settings_v1',
  AUTOPHAGY_SETTINGS: 'eiyou_autophagy_settings_v1',
  AUTOPHAGY_CONFIG: 'eiyou_autophagy_config_v1',
  AUTOPHAGY_LOGS: 'eiyou_autophagy_logs_v1',
  OBSIDIAN_CONFIG: 'eiyou_obsidian_config_v1'
};

/**
 * デフォルトのユーザー栄養目標値
 */
export const DEFAULT_USER_GOALS = {
  calories: 2000,
  protein: 60,
  fat: 55,
  carbs: 250,
  sodium: 7.0,
  fiber: 20.0
};

/**
 * デフォルトの目標許容誤差範囲
 */
export const DEFAULT_TOLERANCES = {
  calories: 100,
  protein: 10,
  fat: 10,
  carbs: 30,
  sodium: 1.0,
  fiber: 3.0
};

/**
 * デフォルトのAIモデル設定
 */
export const DEFAULT_AI_SETTINGS = {
  preferredModel: 'gemini',
  thinkingMode: 'quick',
  geminiApiKey: '',
  deepSeekApiKey: ''
};

