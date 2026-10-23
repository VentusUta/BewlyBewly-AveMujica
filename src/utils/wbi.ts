import md5 from 'md5'

/**
 * 为请求参数进行 WBI 签名
 * https://socialsisteryi.github.io/bilibili-API-collect/docs/misc/sign/wbi.html
 */
const MIXIN_KEY_ENC_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52]

// 取图片 URL 的文件名，如 `https://i0.hdslb.com/bfs/wbi/7cd0…077c.png` → `7cd0…077c`
function getKeyFromUrl(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))
}

/**
 * 由 nav 接口 `wbi_img` 中的 `img_url` 和 `sub_url` 求出混合密钥
 */
export function getWbiMixinKey(imgUrl: string, subUrl: string): string {
  const raw = getKeyFromUrl(imgUrl) + getKeyFromUrl(subUrl)
  return MIXIN_KEY_ENC_TAB.map(i => raw[i]).join('').slice(0, 32)
}

/**
 * 签名请求参数，原有的 `w_rid` 和 `wts` 会被替换
 * @returns the signed query string, without the leading `?`
 */
export function signWbiQuery(params: URLSearchParams | Record<string, string>, mixinKey: string, now = Date.now()): string {
  const entries = new Map(params instanceof URLSearchParams ? params : Object.entries(params))
  entries.delete('w_rid')
  entries.set('wts', String(Math.floor(now / 1000)))
  const query = [...entries.keys()]
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(entries.get(key)!.replace(/[!'()*]/g, ''))}`)
    .join('&')
  return `${query}&w_rid=${md5(query + mixinKey)}`
}
