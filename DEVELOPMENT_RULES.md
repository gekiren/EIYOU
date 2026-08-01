# 開発および実装ルール (DEVELOPMENT_RULES.md)

## 1. 概要
本ドキュメントは栄養記録・管理アプリ (EIYOU) の開発における基本規約、UI仕様、API仕様、ブランチ・ビルド運用ルールを定義します。

## 2. アーキテクチャと一本化開発方針
- **Native版 (Expo / Android) 一本化**: 本プロジェクトの開発・機能追加・UI修正・動作検証はすべて Native版 (`src/App.native.jsx` / Expo / Android) に一本化して進行します。
- **アーキテクチャ**: React Native + Expo + AsyncStorage/safeStorage (Native DB) + Lucide-React
- **共有モジュール (`src/shared_modules`)**:
  - `ai/`: Gemini 3.6 Flash / DeepSeek V4 統合栄養解析モジュール
  - `ocr/`: tesseract.js オンデバイスOCR ＆ パース
  - `db/`: Hybrid / Native ストレージ
  - `csv/`: CSVエクスポート・インポート
  - `worker/`: Cloudflare Worker APIプロキシ

## 3. 主要機能要件
1. **ダッシュボード・栄養管理**:
   - 日別の摂取カロリー・PFC（タンパク質・脂質・炭水化物）・塩分管理と目標進捗バー
2. **写真記録（栄養成分表示 & 料理写真）**:
   - **栄養成分表示モード**: OCR + AI 解析で100g/1包装当たりの栄養価を取得。食べた量の割合（% / グラム / 個数）をインタラクティブ調整。
   - **料理写真モード**: 画像解析による料理候補（検索・類似料理マッチング）の提示、量の倍率調整。
3. **チャット記録**:
   - 自然言語入力（例: 「朝食に鮭おにぎりと味噌汁を食べた」）でAIがメニューを分解・栄養価計算して即時保存。
4. **データ永続化と入出力**:
   - IndexedDB (Dexie) での完全ローカル保存 ＆ CSVインポート/エクスポート
5. **OTA (Over-The-Air) / 迅速更新対応**:
   - Web / PWA / ServiceWorker & EAS Update 互換構成によるネイティブ再ビルド回数削減構成。

## 4. セキュリティ・ブランチ・ビルド管理
- **機密情報の保護**: APIキーは環境変数または設定画面からの動的入力・ローカルストレージ安全保持。
- **ブランチ運用ルール**:
  - `master`（本番用）ブランチでの直接作業、および `origin/master` への直接コミットは禁止。
  - 通常の追加・変更・デバッグ作業はすべて `staging` ブランチで行うこと。
  - **【重要】master ブランチへのマージ制限**: `staging` から `master` へのマージ（および `origin/master` への Push）は、作業完了時に自動で実行してはならない。必ずユーザーから個別に明確な実行指示（「マスターへマージしてください」等）があった場合のみ実行すること。
- **【最重要】OTA (EAS Update) の優先適用と動作規約**:
  - ネイティブライブラリの新規追加や権限変更を伴わない UIの修正、レイアウト変更、ロジック改善、AIプロンプト調整、バグ修正等のすべての変更は、ビルド回数を抑えるため **ネイティブAPKの再ビルドを行わず、必ず OTA (EAS Update) 更新を最優先で適用すること**。
  - **Release ビルドでの検証必須**: Debug ビルド (`assembleDebug`) では Expo の仕様により `expo-updates` モジュールが無効化 (`Updates.isEnabled = false`) されるため、`checkForUpdateAsync()` でエラーが発生する。OTA 機能を動かすためには、必ず **Release ビルド (`assembleRelease`)** で APK を作成すること。
  - **チャネルヘッダーの設定保持**: EAS Update サーバーへのリクエストに `channel-name` ヘッダーが必要なため、`app.json` の `updates.url`（`?channel-name=staging`）および `AndroidManifest.xml`（`expo.modules.updates.EXPO_CHANNEL_NAME`）にチャネル設定を必ず保持させること。
  - **ローカル APK ビルド時の事前 JS バンドル埋め込み**: ローカルで Gradle ビルドを行う際は、Metro サーバー非接続時の `Unable to load script` エラーを防止するため、事前に `npx expo export:embed --platform android --dev false --entry-file index.js --bundle-output "android/app/src/main/assets/index.android.bundle" --assets-dest "android/app/src/main/res"` を実行してオフライン JS バンドルを事前埋め込みしてからビルドを行うこと。



