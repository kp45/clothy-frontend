// src/api/client.js
import axios from 'axios';
import { NativeModules, Platform } from 'react-native';

const PROD_API_URL = 'https://clothyapp.gatijobs.in';

const cleanUrl = (url) => url.replace(/\/+$/, '');

const getBaseUrl = () => {
  // 1. Explicit override via .env (highest priority)
  const envUrl = cleanUrl((process.env.EXPO_PUBLIC_API_BASE_URL || '').trim());
  if (envUrl) return envUrl;

  // 2. In production APK/AAB, use the public deployed API if env is missing.
  if (!__DEV__) return PROD_API_URL;

  // 3. Auto-detect from Metro bundler host (Expo Go / dev client)
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^\w+:\/\/([^/:]+)/);
    if (match) return `http://${match[1]}:8000`;
  }

  // 4. Android emulator special alias for host machine localhost
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';

  // 5. iOS simulator
  return 'http://127.0.0.1:8000';
};

export const BASE_URL = getBaseUrl();

console.log('[API] Connecting to:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
