import { describe, expect, it } from 'vitest'

import { getWbiMixinKey, signWbiQuery } from '~/utils/wbi'

const IMG_URL = 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png'
const SUB_URL = 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png'
const MIXIN_KEY = 'ea1db124af3c7062474693fa704f4ff8'

describe('getWbiMixinKey', () => {
  it('mixes the image and sub keys', () => {
    expect(getWbiMixinKey(IMG_URL, SUB_URL)).toBe(MIXIN_KEY)
  })
})

describe('signWbiQuery', () => {
  it('matches the documented example', () => {
    expect(signWbiQuery({ foo: '114', bar: '514', zab: '1919810' }, MIXIN_KEY, 1702204169 * 1000))
      .toBe('bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4')
  })

  it('replaces an existing signature', () => {
    const params = new URLSearchParams('foo=114&bar=514&zab=1919810&wts=1&w_rid=stale')
    expect(signWbiQuery(params, MIXIN_KEY, 1702204169 * 1000))
      .toBe('bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4')
  })

  it('encodes JSON values like bilibili does', () => {
    expect(signWbiQuery({ 'bvid': 'BV1z9nt6aE5H', 'x-bili-locale-json': '{"c_locale":{"language":"en"},"always_translate":true}' }, MIXIN_KEY, 1792770000 * 1000))
      .toBe('bvid=BV1z9nt6aE5H&wts=1792770000&x-bili-locale-json=%7B%22c_locale%22%3A%7B%22language%22%3A%22en%22%7D%2C%22always_translate%22%3Atrue%7D&w_rid=0bc23f4d43aa2853b35b301f2028391e')
  })

  it('drops the characters bilibili filters out', () => {
    expect(signWbiQuery({ q: 'a!b\'c(d)e*f' }, MIXIN_KEY, 0)).toMatch(/^q=abcdef&wts=0&w_rid=/)
  })
})
