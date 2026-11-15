import { createI18n } from 'vue-i18n'

export const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: {
        operation: { close: 'Close', cancel: 'Cancel', confirm: 'Confirm' },
      },
    },
  },
})
