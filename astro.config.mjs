import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://mafiatun.github.io',
  base: '/unga81-ai-events',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [svelte()],
  build: { inlineStylesheets: 'always', assets: '_assets' },
  devToolbar: { enabled: false },
  vite: { build: { assetsInlineLimit: 0 } },
});
