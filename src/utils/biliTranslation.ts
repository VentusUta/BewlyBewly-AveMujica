import { LanguageType } from '~/enums/appEnums'

import { signWbiQuery } from './wbi'

export const BILI_TRANSLATION_LANGS = ['zh-Hant', 'en'] as const
export type BiliTranslationLang = typeof BILI_TRANSLATION_LANGS[number]
export type BiliTranslationSetting = 'auto' | 'original' | BiliTranslationLang

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

export function getBiliLocaleJson(lang: BiliTranslationLang): string {
  const cLocale = lang === 'zh-Hant' ? { language: 'zh', script: 'Hant' } : { language: lang }
  return JSON.stringify({ c_locale: cLocale, always_translate: true })
}

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

export interface DescSegment {
  raw_text: string
  type: number
}

function linkifyText(text: string): (string | Node)[] {
  const parts: (string | Node)[] = []
  let lastIndex = 0
  for (const match of text.matchAll(/https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+|BV[\dA-Za-z]{10}/g)) {
    parts.push(text.slice(lastIndex, match.index))
    const link = document.createElement('a')
    link.href = match[0].startsWith('BV') ? `//www.bilibili.com/video/${match[0]}/` : match[0]
    link.target = '_blank'
    link.textContent = match[0]
    parts.push(link)
    lastIndex = match.index + match[0].length
  }
  parts.push(text.slice(lastIndex))
  return parts
}

export function applyTranslatedDesc(container: Element, segments: DescSegment[]) {
  const nodes = [...container.children].filter(el => el.matches('span.desc-info-text, a.mention-user'))
  if (nodes.length !== segments.length || nodes.some((el, i) => el.matches('a.mention-user') !== (segments[i].type === 2)))
    return
  nodes.forEach((el, i) => {
    if (segments[i].type !== 2 && el.textContent !== segments[i].raw_text)
      el.replaceChildren(...linkifyText(segments[i].raw_text))
  })
}

const UI_TEXT_REQUEST_PATH = /^\/x\/v2\/reply\/subject\/description$/
const USER_CONTENT_REQUEST_PATH = /^\/x\/v2\/(?:reply\/(?:wbi\/main|main|reply)|dm\/(?:wbi\/)?web\/seg\.so)$/

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
    if (!mixinKey)
      return null
    parsed.search = signWbiQuery(parsed.searchParams, mixinKey)
  }
  return parsed.href
}
