import { LanguageType } from '~/enums/appEnums'

import { signWbiQuery } from './wbi'

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

// B站对繁体中文只转换标题和简介，评论和弹幕仍返回原文
export function canTranslateUserContent(lang: BiliTranslationLang): boolean {
  return lang !== 'zh-Hant'
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

// B站页面自己发出的、可以换成译文的请求。评论框的提示文字等界面文字，繁体中文也会转换
const UI_TEXT_REQUEST_PATH = /^\/x\/v2\/reply\/subject\/description$/
// 评论列表、楼中楼和弹幕
const USER_CONTENT_REQUEST_PATH = /^\/x\/v2\/(?:reply\/(?:wbi\/main|main|reply)|dm\/(?:wbi\/)?web\/seg\.so)$/

/**
 * 把B站页面自己发出的请求改成请求译文，带 WBI 签名的会重新签名
 * @returns the rewritten url, or `null` to send the request as is
 */
export function rewriteBiliRequestUrl(url: string, lang: BiliTranslationLang, mixinKey: string | null): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }
  if (parsed.hostname !== 'api.bilibili.com')
    return null
  const isUserContent = USER_CONTENT_REQUEST_PATH.test(parsed.pathname)
  if (isUserContent ? !canTranslateUserContent(lang) : !UI_TEXT_REQUEST_PATH.test(parsed.pathname))
    return null
  const localeJson = getBiliLocaleJson(lang)
  if (parsed.searchParams.get('x-bili-locale-json') === localeJson)
    return null

  parsed.searchParams.set('x-bili-locale-json', localeJson)
  if (parsed.pathname.includes('/wbi/')) {
    // 签不了名就不改，以免请求失败
    if (!mixinKey)
      return null
    parsed.search = signWbiQuery(parsed.searchParams, mixinKey)
  }
  return parsed.href
}
