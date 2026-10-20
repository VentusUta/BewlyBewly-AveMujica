import { defineConfig, mergeConfig } from 'vite'

import packageJson from './package.json' with { type: 'json' }
import { isDev, isFirefox, isSafari, r } from './scripts/utils.ts'
import { sharedConfig } from './vite.config.ts'

// bundling the content script using Vite
export default defineConfig(mergeConfig(sharedConfig, {
  resolve: {
    alias: [
      // vuedraggable 的 UMD 产物用 require('vue')，Vite 8 会按 require 条件解析到带模板编译器的 vue.cjs.prod.js
      { find: /^vue$/, replacement: 'vue/dist/vue.runtime.esm-bundler.js' },
    ],
  },
  build: {
    watch: isDev
      ? { include: ['./**/*'] }
      : undefined,
    outDir: r(isFirefox ? 'extension-firefox/dist/contentScripts' : isSafari ? 'extension-safari/dist/contentScripts' : 'extension/dist/contentScripts'),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
    lib: {
      entry: r('src/contentScripts/index.ts'),
      name: packageJson.name,
      formats: ['iife'],
      cssFileName: 'style',
    },
    rolldownOptions: {
      output: {
        entryFileNames: 'index.global.js',
        extend: true,
        // Rolldown 默认（'auto'）不给 iife 加 "use strict"，显式开启以保持严格模式
        strict: true,
      },
    },
  },
}))
