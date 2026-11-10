import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueDevTools from 'vite-plugin-vue-devtools'

// Social crawlers need absolute image URLs. Set VITE_SITE_URL to the production
// origin; Cloudflare Pages supplies CF_PAGES_URL (the preview or production URL
// of the build) as a fallback.
const siteUrl = (process.env.VITE_SITE_URL || process.env.CF_PAGES_URL || '')
  .replace(/\/$/, '')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // vueDevTools(),
    {
      name: 'site-url',
      transformIndexHtml: html => html.replaceAll('%SITE_URL%', siteUrl),
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      usePolling: true,
    },
  },
})
