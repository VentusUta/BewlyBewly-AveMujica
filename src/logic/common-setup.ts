import 'vue-toastification/dist/index.css'

import type { Pinia } from 'pinia'
import type { App } from 'vue'
import Toast, { POSITION } from 'vue-toastification'

import components from '~/components'
import { i18n } from '~/utils/i18n'

export function setupApp(app: App, pinia: Pinia) {
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
