import 'vue-toastification/dist/index.css'

import { createPinia } from 'pinia'
import type { App } from 'vue'
import Toast, { POSITION } from 'vue-toastification'

import components from '~/components'
import { i18n } from '~/utils/i18n'

const pinia = createPinia()

export async function setupApp(app: App) {
  // Here you can install additional plugins for all contexts: popup, options page and content-script.
  // example: app.use(i18n)
  app.use(i18n)
  app
    .use(Toast, {
      transition: 'Vue-Toastification__fade',
      maxToasts: 20,
      newestOnTop: true,
      position: POSITION.TOP_RIGHT,
    })
  app.use(components)
  app.use(pinia)
}
