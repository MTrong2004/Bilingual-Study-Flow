import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // IMPORTANT: Set base to './' for GitHub Pages deployment
    base: './',
    define: {
      // Polyfill process.env for the app to work with 'process.env.API_KEY'
      'process.env': env
    },
  };
});