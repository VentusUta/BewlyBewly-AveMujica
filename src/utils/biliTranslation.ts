import { LanguageType } from '~/enums/appEnums'

// 设置里可选的翻译语言，暂只支持中文和英文。简体中文是原文，无需翻译
export const BILI_TRANSLATION_LANGS = ['zh-Hant', 'en'] as const
export type BiliTranslationLang = typeof BILI_TRANSLATION_LANGS[number]
export type BiliTranslationSetting = 'auto' | 'original' | BiliTranslationLang

/**
 * 求出设置项实际对应的翻译语言，「自动」按界面语言决定
 * @returns the language to translate into, or `null` to keep the original text
 */
export function resolveBiliTranslation(setting: string, language: string): BiliTranslationLang | null {
  if ((BILI_TRANSLATION_LANGS as readonly string[]).includes(setting))
    return setting as BiliTranslationLang
  if (setting === 'original')
    return null
  switch (language) {
    case LanguageType.Mandarin_TW:
    case LanguageType.Cantonese:
      return 'zh-Hant'
    case LanguageType.English:
      return 'en'
    default:
      return null
  }
}

/**
 * B站接口的 `x-bili-locale-json` 参数，开启 `always_translate` 后接口会返回官方的 AI 译文，与站点无关
 */
export function getBiliLocaleJson(lang: BiliTranslationLang): string {
  const cLocale = lang === 'zh-Hant' ? { language: 'zh', script: 'Hant' } : { language: lang }
  return JSON.stringify({ c_locale: cLocale, always_translate: true })
}

export function getBiliLocaleParams(lang: BiliTranslationLang | null): { 'x-bili-locale-json'?: string } {
  return lang ? { 'x-bili-locale-json': getBiliLocaleJson(lang) } : {}
}

interface TranslatableItem {
  title: string
  translate_status?: string
  translated_title?: string
}

export function getTranslatedTitle(item: TranslatableItem): string {
  return item.translate_status === 'translated' && item.translated_title ? item.translated_title : item.title
}
