/**
 * Expo React Native エントリーポイント
 * Expo のデフォルトエントリ (AppEntry.js) が "./App" を参照するため、
 * src/App.jsx をラップして re-export します。
 */
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
