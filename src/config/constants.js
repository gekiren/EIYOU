/**
 * EIYOU アプリケーション固定設定値
 * Cloudflare Worker プロキシ URL などの秘匿設定をアプリ側に完全固定し、
 * ユーザーが変更・参照できないようにカプセル化します。
 */

// 正しい Cloudflare Worker プロキシ URL
export const SECURE_WORKER_PROXY_URL = 'https://eiyou-ai-proxy.toshi-diyil.workers.dev';
