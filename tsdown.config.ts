import { defineConfig } from 'tsdown'

import { isDev, isFirefox, isSafari } from './scripts/utils.ts'

const outDir = isFirefox ? 'extension-firefox/dist' : isSafari ? 'extension-safari/dist' : 'extension/dist'

export default defineConfig({
  entry: {
    'background/index': './src/background/index.ts',
  },
  copy: { from: 'src/inject/index.js', to: `${outDir}/inject` },
  outDir,
  clean: false,
  format: ['iife'],
  target: 'esnext',
  ignoreWatch: ['**/extension/**', '**/extension-firefox/**', '**/extension-safari/**'],
  outputOptions: { codeSplitting: false, strict: true, entryFileNames: '[name].js' },
  sourcemap: false, // https://github.com/vitejs/vite-plugin-vue/issues/35
  define: {
    '__DEV__': JSON.stringify(isDev),
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
    'process.env.FIREFOX': isFirefox ? 'true' : 'false',
  },
  platform: 'browser',
  minify: isDev ? false : { compress: true, mangle: false, codegen: { removeWhitespace: true } },
  deps: { onlyBundle: ['webextension-polyfill'] },
})
