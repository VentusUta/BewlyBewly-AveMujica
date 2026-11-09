import { createPinia } from 'pinia'
import type { App } from 'vue'

import components from '~/components'
import { i18n } from '~/utils/i18n'

const pinia = createPinia()

export async function setupApp(app: App) {
  // Here you can install additional plugins for all contexts: popup, options page and content-script.
  // example: app.use(i18n)
  app.use(i18n)
  app.use(components)
  app.use(pinia)
}
