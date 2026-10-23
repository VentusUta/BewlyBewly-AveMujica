import { describe, expect, it } from 'vitest'

import { LanguageType } from '~/enums/appEnums'
import { canTranslateUserContent, getBiliLocaleJson, getBiliLocaleParams, getTranslatedTitle, resolveBiliTranslation, rewriteBiliRequestUrl } from '~/utils/biliTranslation'
import { signWbiQuery } from '~/utils/wbi'

const MIXIN_KEY = 'ea1db124af3c7062474693fa704f4ff8'
const EN = '{"c_locale":{"language":"en"},"always_translate":true}'
const ZH_HANS = '{"c_locale":{"language":"zh","script":"Hans"},"always_translate":false}'
const ZH_HANT = '{"c_locale":{"language":"zh","script":"Hant"},"always_translate":true}'

describe('resolveBiliTranslation', () => {
  it.each([
    [LanguageType.Mandarin_CN, null],
    [LanguageType.Mandarin_TW, 'zh-Hant'],
    [LanguageType.Cantonese, 'zh-Hant'],
    [LanguageType.English, 'en'],
    ['', null],
  ])('resolves auto with interface language %s to %s', (language, expected) => {
    expect(resolveBiliTranslation('auto', language)).toBe(expected)
  })

  it('uses an explicit choice regardless of the interface language', () => {
    expect(resolveBiliTranslation('original', LanguageType.English)).toBeNull()
    expect(resolveBiliTranslation('en', LanguageType.Mandarin_CN)).toBe('en')
    expect(resolveBiliTranslation('zh-Hant', LanguageType.English)).toBe('zh-Hant')
  })

  it('treats an unsupported value as auto', () => {
    expect(resolveBiliTranslation('ja', LanguageType.English)).toBe('en')
  })
})

describe('getBiliLocaleJson', () => {
  it('builds the locale bilibili expects', () => {
    expect(getBiliLocaleJson('en')).toBe(EN)
    expect(getBiliLocaleJson('zh-Hant')).toBe('{"c_locale":{"language":"zh","script":"Hant"},"always_translate":true}')
  })

  it('adds no parameter when not translating', () => {
    expect(getBiliLocaleParams(null)).toEqual({})
    expect(getBiliLocaleParams('en')).toEqual({ 'x-bili-locale-json': EN })
  })
})

describe('getTranslatedTitle', () => {
  it('prefers the translated title only when it was translated', () => {
    expect(getTranslatedTitle({ title: '原文', translate_status: 'translated', translated_title: 'Translated' })).toBe('Translated')
    expect(getTranslatedTitle({ title: '原文', translate_status: 'origin', translated_title: '' })).toBe('原文')
    expect(getTranslatedTitle({ title: '原文' })).toBe('原文')
  })
})

describe('rewriteBiliRequestUrl', () => {
  it('replaces the locale on danmaku requests and signs them again', () => {
    const query = signWbiQuery({ 'oid': '1', 'segment_index': '1', 'x-bili-locale-json': ZH_HANS }, MIXIN_KEY, 1000)
    const rewritten = new URL(rewriteBiliRequestUrl(`https://api.bilibili.com/x/v2/dm/wbi/web/seg.so?${query}`, 'en', MIXIN_KEY)!)
    expect(rewritten.pathname).toBe('/x/v2/dm/wbi/web/seg.so')
    expect(rewritten.searchParams.get('x-bili-locale-json')).toBe(EN)
    expect(rewritten.searchParams.get('w_rid')).not.toBe(new URLSearchParams(query).get('w_rid'))
  })

  it('signs comment requests so the signature covers the new locale', () => {
    const rewritten = rewriteBiliRequestUrl(`https://api.bilibili.com/x/v2/reply/wbi/main?oid=1&type=1&x-bili-locale-json=${encodeURIComponent(ZH_HANS)}&w_rid=x&wts=1`, 'en', MIXIN_KEY)!
    const params = new URL(rewritten).searchParams
    const wts = Number(params.get('wts'))
    params.delete('w_rid')
    params.delete('wts')
    expect(new URL(rewritten).search.slice(1)).toBe(signWbiQuery(params, MIXIN_KEY, wts * 1000))
  })

  it('rewrites unsigned reply requests without a key', () => {
    const rewritten = rewriteBiliRequestUrl('https://api.bilibili.com/x/v2/reply/reply?oid=1&root=2', 'en', null)
    expect(new URL(rewritten!).searchParams.get('x-bili-locale-json')).toBe(EN)
  })

  it.each([
    ['en', EN],
    ['zh-Hant', ZH_HANT],
  ] as const)('rewrites the comment box hints for %s', (lang, locale) => {
    const rewritten = rewriteBiliRequestUrl(`https://api.bilibili.com/x/v2/reply/subject/description?oid=1&type=1&x-bili-locale-json=${encodeURIComponent(ZH_HANS)}`, lang, null)
    expect(new URL(rewritten!).searchParams.get('x-bili-locale-json')).toBe(locale)
  })

  it('leaves comments and danmaku alone for Traditional Chinese', () => {
    expect(rewriteBiliRequestUrl('https://api.bilibili.com/x/v2/reply/reply?oid=1&root=2', 'zh-Hant', null)).toBeNull()
    expect(rewriteBiliRequestUrl('https://api.bilibili.com/x/v2/dm/wbi/web/seg.so?oid=1', 'zh-Hant', MIXIN_KEY)).toBeNull()
  })

  it.each([
    ['a signed request without a key', `https://api.bilibili.com/x/v2/reply/wbi/main?oid=1`, null],
    ['a request already in the language', `https://api.bilibili.com/x/v2/reply/reply?x-bili-locale-json=${encodeURIComponent(EN)}`, MIXIN_KEY],
    ['an unrelated request', 'https://api.bilibili.com/x/v2/reply/action?oid=1', MIXIN_KEY],
    ['another host', 'https://example.com/x/v2/reply/reply', MIXIN_KEY],
    ['an invalid url', 'not a url', MIXIN_KEY],
  ])('leaves %s as is', (_, url, key) => {
    expect(rewriteBiliRequestUrl(url, 'en', key)).toBeNull()
  })
})

describe('canTranslateUserContent', () => {
  it('skips comments and danmaku for Traditional Chinese', () => {
    expect(canTranslateUserContent('en')).toBe(true)
    expect(canTranslateUserContent('zh-Hant')).toBe(false)
  })
})
