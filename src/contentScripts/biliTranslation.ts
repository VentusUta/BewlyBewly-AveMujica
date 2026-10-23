import { settings } from '~/logic'
import type { BiliTranslationLang } from '~/utils/biliTranslation'
import { getBiliLocaleParams, resolveBiliTranslation } from '~/utils/biliTranslation'

function getBiliTranslationLang(): BiliTranslationLang | null {
  return resolveBiliTranslation(settings.value.biliTranslation, settings.value.language)
}

/**
 * 请求首页列表时附带的参数，让接口一并返回官方译文
 */
export function getBiliTranslationParams() {
  return getBiliLocaleParams(getBiliTranslationLang())
}
