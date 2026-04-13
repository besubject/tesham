import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  define: {
    // react-native-web и его зависимости ожидают Node.js-глобал `global`.
    // В браузере его нет — подменяем на window.
    global: 'globalThis',
    'process.env': '{}',
    'process.env.NODE_ENV': JSON.stringify('development'),
    __DEV__: JSON.stringify(true),
    __PLATFORM__: JSON.stringify('web'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'src': path.resolve(__dirname, './src'),
      '@mettig/shared': path.resolve(__dirname, '../../packages/shared/src'),
      // react-native → web-реализация примитивов (View, Text, StyleSheet…)
      'react-native': 'react-native-web',
      // expo-пакеты не работают в браузере — подменяем веб-шимами
      'expo-secure-store': path.resolve(__dirname, './src/shims/expo-secure-store.ts'),
      'expo-application': path.resolve(__dirname, './src/shims/expo-application.ts'),
      'expo-location': path.resolve(__dirname, './src/shims/expo-location.ts'),
      'invariant': path.resolve(__dirname, '../../node_modules/invariant/browser.js'),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  optimizeDeps: {
    // expo (сам пакет-оркестратор) не бандлим — он нужен только Metro
    exclude: ['expo'],
    include: ['invariant', 'react-native-web'],
  },
  ssr: {
    noExternal: ['invariant', 'react-native-web'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
