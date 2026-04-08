import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mettig/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
    // Exclude react-native and expo from bundling
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      external: ['react-native', 'expo', 'expo-*'],
    },
  },
  optimizeDeps: {
    exclude: ['react-native', 'expo'],
  },
});
