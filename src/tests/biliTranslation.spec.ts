import { describe, expect, it } from 'vitest'

import { LanguageType } from '~/enums/appEnums'
import { getBiliLocaleJson, getBiliLocaleParams, getTranslatedTitle, resolveBiliTranslation } from '~/utils/biliTranslation'

const EN = '{"c_locale":{"language":"en"},"always_translate":true}'

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
