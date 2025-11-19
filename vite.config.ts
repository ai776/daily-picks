import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Vercel等の環境変数をロードしてprocess.envとして使えるようにする
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // コード内の process.env.API_KEY をビルド時に置換する
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});