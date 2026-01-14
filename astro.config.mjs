import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://swapnilsingh.github.io',
  base: import.meta.env.PROD ? '/entitle-website' : '/',
  output: 'static',
});
