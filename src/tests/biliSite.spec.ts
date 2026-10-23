import { afterEach, describe, expect, it } from 'vitest'

import { getBiliSiteUrl, resolveBiliSite } from '~/utils/biliSite'

describe('resolveBiliSite', () => {
  it('uses the Mainland China site, which overseas falls back to for now', () => {
    expect(resolveBiliSite('CN')).toBe('CN')
    expect(resolveBiliSite('OVERSEAS')).toBe('CN')
  })

  describe('when bilibili forces the overseas site for the account', () => {
    const setCookie = (name: string, value: string, expires = '') => {
      document.cookie = `${name}=${value}; path=/${expires}`
    }
    const clearCookies = () => {
      for (const name of ['DedeUserID', 'default_sites'])
        setCookie(name, '', '; expires=Thu, 01 Jan 1970 00:00:00 GMT')
    }
    afterEach(clearCookies)

    it('uses Simplified Chinese overseas instead of the Mainland China site', () => {
      setCookie('DedeUserID', '1')
      setCookie('default_sites', encodeURIComponent('["OVERSEAS"]'))
      expect(resolveBiliSite('CN')).toBe('zh-Hans')
    })

    it.each([
      ['not logged in', '', '["OVERSEAS"]'],
      ['both sites allowed', '1', '["CN","OVERSEAS"]'],
      ['no default_sites', '1', ''],
    ])('keeps the Mainland China site when %s', (_, userId, sites) => {
      if (userId)
        setCookie('DedeUserID', userId)
      if (sites)
        setCookie('default_sites', encodeURIComponent(sites))
      expect(resolveBiliSite('CN')).toBe('CN')
    })
  })
})

describe('getBiliSiteUrl', () => {
  it.each([
    ['https://www.bilibili.com/en', 'https://www.bilibili.com/'],
    ['https://www.bilibili.com/en?page=History', 'https://www.bilibili.com/?page=History'],
    ['https://www.bilibili.com/zh-Hans/video/BV1GJ411x7h7/', 'https://www.bilibili.com/video/BV1GJ411x7h7/'],
    ['https://search.bilibili.com/ja/all?keyword=a', 'https://search.bilibili.com/all?keyword=a'],
  ])('moves %s to the China site', (url, expected) => {
    expect(getBiliSiteUrl(url, 'CN')).toBe(expected)
  })

  it.each([
    'https://www.bilibili.com/',
    'https://www.bilibili.com/anime/',
    'https://t.bilibili.com/',
  ])('keeps %s on the China site', (url) => {
    expect(getBiliSiteUrl(url, 'CN')).toBeNull()
  })

  it.each([
    ['https://www.bilibili.com/', 'https://www.bilibili.com/en'],
    ['https://www.bilibili.com/?page=History', 'https://www.bilibili.com/en?page=History'],
    ['https://www.bilibili.com/video/BV1GJ411x7h7/', 'https://www.bilibili.com/en/video/BV1GJ411x7h7/'],
    ['https://www.bilibili.com/zh-Hans/video/BV1GJ411x7h7/', 'https://www.bilibili.com/en/video/BV1GJ411x7h7/'],
    ['https://www.bilibili.com/bangumi/play/ss1', 'https://www.bilibili.com/en/bangumi/play/ss1'],
    ['https://www.bilibili.com/list/watchlater?bvid=BV1GJ411x7h7', 'https://www.bilibili.com/en/list/watchlater?bvid=BV1GJ411x7h7'],
    ['https://www.bilibili.com/history', 'https://www.bilibili.com/en/history'],
    ['https://search.bilibili.com/all?keyword=a', 'https://search.bilibili.com/en/all?keyword=a'],
    ['https://space.bilibili.com/2/favlist', 'https://space.bilibili.com/en/2/favlist'],
  ])('moves %s to the English overseas site', (url, expected) => {
    expect(getBiliSiteUrl(url, 'en')).toBe(expected)
  })

  it.each([
    'https://www.bilibili.com/en',
    'https://www.bilibili.com/en/video/BV1GJ411x7h7/',
    // 海外站点没有这些页面
    'https://www.bilibili.com/anime/',
    'https://www.bilibili.com/v/popular/all',
    'https://www.bilibili.com/index.html',
    'https://t.bilibili.com/',
    'https://passport.bilibili.com/login',
  ])('leaves %s as is for the English overseas site', (url) => {
    expect(getBiliSiteUrl(url, 'en')).toBeNull()
  })
})
