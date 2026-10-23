import { describe, expect, it } from 'vitest'

import { isHomePage, isNotificationPage, isVideoOrBangumiPage, stripBiliLangPrefix } from '~/utils/main'

describe('stripBiliLangPrefix', () => {
  it.each([
    ['https://www.bilibili.com/en', 'https://www.bilibili.com/'],
    ['https://www.bilibili.com/zh-Hans/', 'https://www.bilibili.com/'],
    ['https://www.bilibili.com/en?spm_id_from=333.1007', 'https://www.bilibili.com/?spm_id_from=333.1007'],
    ['https://www.bilibili.com/ja?page=Search#top', 'https://www.bilibili.com/?page=Search#top'],
    ['https://www.bilibili.com/zh-Hant/video/BV1GJ411x7h7/', 'https://www.bilibili.com/video/BV1GJ411x7h7/'],
    ['https://search.bilibili.com/en/all?keyword=a', 'https://search.bilibili.com/all?keyword=a'],
    ['https://space.bilibili.com/en/2/favlist', 'https://space.bilibili.com/2/favlist'],
  ])('strips the prefix from %s', (url, expected) => {
    expect(stripBiliLangPrefix(url)).toBe(expected)
  })

  it.each([
    'https://www.bilibili.com/',
    'https://www.bilibili.com/video/BV1GJ411x7h7/',
    'https://www.bilibili.com/zh-hans/',
    'https://www.bilibili.com/EN/',
    'https://www.bilibili.com/english/',
    'https://www.bilibili.com/v/popular/all',
    'https://example.com/en/video/BV1GJ411x7h7/',
    'about:blank',
    'not a url',
  ])('keeps %s unchanged', (url) => {
    expect(stripBiliLangPrefix(url)).toBe(url)
  })
})

describe('page matchers with a language prefix', () => {
  it('matches the homepage', () => {
    expect(isHomePage('https://www.bilibili.com/en')).toBe(true)
    expect(isHomePage('https://www.bilibili.com/zh-Hans?spm_id_from=333.1007')).toBe(true)
    expect(isHomePage('https://www.bilibili.com/en?page=Search')).toBe(true)
    expect(isHomePage('https://www.bilibili.com/en/video/BV1GJ411x7h7/')).toBe(false)
  })

  it('matches video and bangumi pages', () => {
    expect(isVideoOrBangumiPage('https://www.bilibili.com/en/video/BV1GJ411x7h7/')).toBe(true)
    expect(isVideoOrBangumiPage('https://www.bilibili.com/zh-Hant/bangumi/play/ss1')).toBe(true)
    expect(isVideoOrBangumiPage('https://www.bilibili.com/ja/watchlater/list')).toBe(true)
  })

  it('matches the notifications page', () => {
    expect(isNotificationPage('https://message.bilibili.com/en/')).toBe(true)
  })
})
