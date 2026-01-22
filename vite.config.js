import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: ['entitle.avasc.in'],
  },
  preview: {
    allowedHosts: true,
  },
});
