import type { BiliLang } from './main'
import { getCookie, isBiliLang, setCookie, stripBiliLangPrefix } from './main'

/** `CN` 为中国大陆站点，其余为对应语言的海外站点 */
type BiliSite = 'CN' | BiliLang

// 登录后B站只按账号下发的 default_sites 决定站点，其中只有海外站点时，B站的服务端和前端都会强制跳到海外站点
function isOverseasForced(): boolean {
  if (!getCookie('DedeUserID'))
    return false
  try {
    const sites = JSON.parse(decodeURIComponent(getCookie('default_sites')))
    return Array.isArray(sites) && sites.includes('OVERSEAS') && !sites.includes('CN')
  }
  catch {
    return false
  }
}

/**
 * 求出要使用的站点，固定为中国大陆站点；
 * B站强制使用海外站点时，以海外的简体中文代替中国大陆站点，以免与B站来回跳
 */
export function getTargetBiliSite(): BiliSite {
  return isOverseasForced() ? 'zh-Hans' : 'CN'
}

/**
 * 写入B站自己用来记住站点和语言的 cookie，与B站「头像 - 语言」写入的相同
 */
function setBiliSiteCookies(site: BiliSite) {
  const cookies = site === 'CN'
    ? { user_site: 'CN' }
    : { user_site: 'OVERSEAS', lang: site }
  for (const [name, value] of Object.entries(cookies)) {
    if (getCookie(name) !== value)
      setCookie(name, value, 365)
  }
}

// 海外站点也有的页面，其余页面加上语言前缀会 404
function hasOverseasVersion(url: URL): boolean {
  if (url.hostname === 'search.bilibili.com' || url.hostname === 'space.bilibili.com')
    return true
  return url.hostname === 'www.bilibili.com'
    && /^\/(?:$|video\/|list\/|bangumi\/play\/|history|watchlater\/list)/.test(url.pathname)
}

/**
 * 求出页面所在的站点
 */
function getCurrentBiliSite(url: string): BiliSite {
  const strippedUrl = stripBiliLangPrefix(url)
  if (strippedUrl === url)
    return 'CN'
  const firstSegment = new URL(url).pathname.split('/')[1]
  return isBiliLang(firstSegment) ? firstSegment : 'CN'
}

/**
 * 求出当前页面在目标站点上的 URL
 * @returns the url to go to, or `null` if the page is already on the site or has no version there
 */
export function getBiliSiteUrl(url: string, site: BiliSite): string | null {
  const currentSite = getCurrentBiliSite(url)
  if (currentSite === site)
    return null
  if (site === 'CN')
    return stripBiliLangPrefix(url)

  let parsed: URL
  try {
    parsed = new URL(stripBiliLangPrefix(url))
  }
  catch {
    return null
  }
  if (!hasOverseasVersion(parsed))
    return null

  parsed.pathname = parsed.pathname === '/' ? `/${site}` : `/${site}${parsed.pathname}`
  return parsed.href
}

const REDIRECT_GUARD_KEY = 'bewly-bili-site-redirect'

/**
 * 写入站点 cookie，并在当前页面不在要使用的站点时跳过去
 */
export function syncBiliSite() {
  const site = getTargetBiliSite()
  const targetUrl = getBiliSiteUrl(location.href, site)
  if (!targetUrl) {
    setBiliSiteCookies(site)
    try {
      sessionStorage.removeItem(REDIRECT_GUARD_KEY)
    }
    catch {}
    return
  }

  // B站服务端偶尔不认 cookie，又把页面跳回来。跳过去后没能停在目标页面时，10 秒内不再跳同一目标，
  // 并让 cookie 先与当前页面一致，否则B站自己的前端也会按 cookie 跳走，来回跳个不停
  let isBounced = true
  try {
    const last = JSON.parse(sessionStorage.getItem(REDIRECT_GUARD_KEY) || 'null')
    isBounced = last?.targetUrl === targetUrl && Date.now() - last.time < 10_000
    if (!isBounced)
      sessionStorage.setItem(REDIRECT_GUARD_KEY, JSON.stringify({ targetUrl, time: Date.now() }))
  }
  catch {}

  if (isBounced) {
    setBiliSiteCookies(getCurrentBiliSite(location.href))
    return
  }
  setBiliSiteCookies(site)
  location.replace(targetUrl)
}
