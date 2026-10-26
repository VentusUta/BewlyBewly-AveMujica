import { settings } from '~/logic'
import api from '~/utils/api'
import type { BiliTranslationLang, DescSegment } from '~/utils/biliTranslation'
import { applyTranslatedDesc, getBiliLocaleJson, getBiliLocaleParams, getTranslatedTitle, resolveBiliTranslation, rewriteBiliRequestUrl } from '~/utils/biliTranslation'
import { queryDomUntilFound } from '~/utils/main'
import { getWbiMixinKey, signWbiQuery } from '~/utils/wbi'

function getBiliTranslationLang(): BiliTranslationLang | null {
  return resolveBiliTranslation(settings.value.biliTranslation, settings.value.language)
}

export function getBiliTranslationParams() {
  return getBiliLocaleParams(getBiliTranslationLang())
}

let mixinKey: string | null = null
let mixinKeyPromise: Promise<string | null> | null = null

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

function translateVideoInfo(lang: BiliTranslationLang) {
  let currentBvid = ''
  let translated: { title: string, desc: DescSegment[] } | null = null
  let observer: MutationObserver | null = null

  const apply = () => {
    if (!translated)
      return
    const titleEl = document.querySelector<HTMLElement>('h1.video-title')
    if (titleEl && titleEl.textContent !== translated.title) {
      titleEl.textContent = translated.title
      titleEl.title = translated.title
    }
    const descContainer = document.querySelector('.basic-desc-info')
    if (descContainer)
      applyTranslatedDesc(descContainer, translated.desc)
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
    translated = {
      title: getTranslatedTitle(res.data),
      desc: res.data.desc_v2?.length ? res.data.desc_v2 : [{ raw_text: res.data.desc, type: 1 }],
    }

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
  window.addEventListener('pushstate', () => setTimeout(load))
  window.addEventListener('popstate', load)
}

export function setupBiliTranslation() {
  const lang = getBiliTranslationLang()
  if (!lang)
    return
  loadWbiMixinKey()

  window.addEventListener('bewly:rewrite-bili-request', (event) => {
    const url = (event as CustomEvent).detail
    const rewrittenUrl = typeof url === 'string' ? rewriteBiliRequestUrl(url, lang, mixinKey) : null
    window.dispatchEvent(new CustomEvent('bewly:bili-request-rewritten', { detail: rewrittenUrl ?? '' }))
  })

  if (/\/video\/BV/i.test(location.pathname))
    translateVideoInfo(lang)
}
