import { createI18n } from 'vue-i18n'

/** 组件模板里`$t`用到的最小语言包 */
export const testI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: {
        notifications: 'Notifications',
        operation: { close: 'Close', cancel: 'Cancel', confirm: 'Confirm' },
      },
    },
  },
})
