import { settings } from '~/logic'
import api from '~/utils/api'
import type { BiliTranslationLang } from '~/utils/biliTranslation'
import { canTranslateUserContent, getBiliLocaleJson, getBiliLocaleParams, getTranslatedTitle, resolveBiliTranslation, rewriteBiliRequestUrl } from '~/utils/biliTranslation'
import { queryDomUntilFound } from '~/utils/main'
import { getWbiMixinKey, signWbiQuery } from '~/utils/wbi'

function getBiliTranslationLang(): BiliTranslationLang | null {
  return resolveBiliTranslation(settings.value.biliTranslation, settings.value.language)
}

/**
 * 请求首页列表时附带的参数，让接口一并返回官方译文
 */
export function getBiliTranslationParams() {
  return getBiliLocaleParams(getBiliTranslationLang())
}

let mixinKey: string | null = null
let mixinKeyPromise: Promise<string | null> | null = null

// B站页面会把 WBI 密钥缓存在 localStorage，没有时再请求 nav 接口
function loadWbiMixinKey(): Promise<string | null> {
  if (mixinKeyPromise)
    return mixinKeyPromise
  const imgUrl = localStorage.getItem('wbi_img_url')
  const subUrl = localStorage.getItem('wbi_sub_url')
  if (imgUrl && subUrl) {
    mixinKey = getWbiMixinKey(imgUrl, subUrl)
    mixinKeyPromise = Promise.resolve(mixinKey)
    return mixinKeyPromise
  }
  mixinKeyPromise = api.user.getUserInfo()
    .then((res) => {
      const wbiImg = res?.data?.wbi_img
      mixinKey = wbiImg ? getWbiMixinKey(wbiImg.img_url, wbiImg.sub_url) : null
      return mixinKey
    })
    .catch(() => null)
  return mixinKeyPromise
}

// 视频页的标题和简介由服务端渲染，另行请求译文后替换
function translateVideoInfo(lang: BiliTranslationLang) {
  let currentBvid = ''
  let translated: { title: string, desc: string } | null = null
  let observer: MutationObserver | null = null

  const apply = () => {
    if (!translated)
      return
    const titleEl = document.querySelector<HTMLElement>('h1.video-title')
    if (titleEl && titleEl.textContent !== translated.title) {
      titleEl.textContent = translated.title
      titleEl.title = translated.title
    }
    const descEl = document.querySelector<HTMLElement>('.basic-desc-info .desc-info-text')
    if (descEl && translated.desc && descEl.textContent !== translated.desc)
      descEl.textContent = translated.desc
  }

  const load = async () => {
    const bvid = location.pathname.match(/\/video\/(BV[\dA-Z]{10})/i)?.[1]
    if (!bvid || bvid === currentBvid)
      return
    currentBvid = bvid
    translated = null

    const key = await loadWbiMixinKey()
    if (!key)
      return
    const query = signWbiQuery({ 'bvid': bvid, 'x-bili-locale-json': getBiliLocaleJson(lang) }, key)
    const res = await api.video.getVideoInfoWbi(Object.fromEntries(new URLSearchParams(query))).catch(() => null)
    if (bvid !== currentBvid || res?.code !== 0 || res.data?.translate_status !== 'translated')
      return
    translated = { title: getTranslatedTitle(res.data), desc: res.data.desc }

    // B站重新渲染时会把原文写回去，盯住标题和简介所在的区域
    const abort = new AbortController()
    setTimeout(() => abort.abort(), 15_000)
    const container = await queryDomUntilFound('.video-info-container', 200, abort)
    abort.abort()
    const descContainer = document.querySelector('.basic-desc-info')
    observer?.disconnect()
    observer = new MutationObserver(apply)
    for (const el of [container, descContainer]) {
      if (el)
        observer.observe(el, { childList: true, subtree: true, characterData: true })
    }
    apply()
  }

  load()
  // 在视频页内切换视频时不会刷新页面
  window.addEventListener('pushstate', () => setTimeout(load))
  window.addEventListener('popstate', load)
}

/**
 * 让B站页面自己发出的评论、弹幕请求改为请求官方译文，并替换视频页的标题和简介
 */
export function setupBiliTranslation() {
  const lang = getBiliTranslationLang()
  if (!lang)
    return
  loadWbiMixinKey()

  if (canTranslateUserContent(lang)) {
    const localeJson = getBiliLocaleJson(lang)
    // 页面环境的注入脚本同步派发请求，这里同步回应改写后的 URL，空字符串表示照常请求
    window.addEventListener('bewly:rewrite-bili-request', (event) => {
      const url = (event as CustomEvent).detail
      const rewrittenUrl = typeof url === 'string' ? rewriteBiliRequestUrl(url, localeJson, mixinKey) : null
      window.dispatchEvent(new CustomEvent('bewly:bili-request-rewritten', { detail: rewrittenUrl ?? '' }))
    })
  }

  if (/\/video\/BV/i.test(location.pathname))
    translateVideoInfo(lang)
}
