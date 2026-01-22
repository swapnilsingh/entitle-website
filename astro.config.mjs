import { defineConfig } from 'astro/config';
import viteConfig from './vite.config.js';

// https://astro.build/config
export default defineConfig({
  site: 'https://swapnilsingh.github.io',
  output: 'static',
  vite: viteConfig,
});
