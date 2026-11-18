import type { Ref } from 'vue'

const DARK_LUMA_THRESHOLD = 128
const LIGHT_DEBOUNCE_MS = 180
const IMAGE_DEBOUNCE_MS = 50
const SAMPLE_WIDTH = 64
const SAMPLE_HEIGHT = 16
const MAX_CACHE_ENTRIES = 32
const MAX_BLOCKED_FRAMES = 120

const IGNORED_SELECTOR = '#bewly, .link-navbar, .link-navbar-ctnr, #link-navbar-vm, #biliMainHeader, .bili-header'

type RgbaTuple = [number, number, number, number]
type RgbTuple = [number, number, number]

interface SampledStrip {
  premulR: number
  premulG: number
  premulB: number
  alpha: number
}

const stripSampleCache = new Map<string, SampledStrip>()

function getViewportWidth(): number {
  if (typeof window === 'undefined')
    return 1280
  return Math.max(320, window.innerWidth || document.documentElement?.clientWidth || 1280)
}

function normalizeImageUrl(rawUrl: string): string {
  if (rawUrl.startsWith('//'))
    return `https:${rawUrl}`
  if (/^http:\/\/[^/]*\.hdslb\.com\//i.test(rawUrl))
    return rawUrl.replace(/^http:/i, 'https:')
  return rawUrl
}

function extractBgImageUrl(bgImage: string): string | null {
  if (!bgImage || bgImage === 'none')
    return null
  const match = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^"'\s)]+))\s*\)/i.exec(bgImage)
  const raw = (match?.[1] ?? match?.[2] ?? match?.[3])?.trim()
  if (!raw || raw === 'none')
    return null
  return normalizeImageUrl(raw)
}

function parseColorChannel(raw: string): number {
  const trimmed = raw.trim()
  if (trimmed.endsWith('%'))
    return Math.min(255, Math.max(0, (Number.parseFloat(trimmed) / 100) * 255))
  return Math.min(255, Math.max(0, Number.parseFloat(trimmed)))
}

function parseAlphaChannel(raw: string | undefined): number {
  if (!raw)
    return 1
  const trimmed = raw.trim()
  if (trimmed.endsWith('%'))
    return Math.min(1, Math.max(0, Number.parseFloat(trimmed) / 100))
  const val = Number.parseFloat(trimmed)
  return Number.isFinite(val) ? Math.min(1, Math.max(0, val)) : 1
}

function parseCssColor(raw: string): RgbaTuple | null {
  const color = raw.trim().toLowerCase()
  if (!color || color === 'transparent')
    return [0, 0, 0, 0]

  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16)
      const g = Number.parseInt(hex[1] + hex[1], 16)
      const b = Number.parseInt(hex[2] + hex[2], 16)
      const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1
      return Number.isNaN(r + g + b + a) ? null : [r, g, b, a]
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
      return Number.isNaN(r + g + b + a) ? null : [r, g, b, a]
    }
    return null
  }

  const fnMatch = /^rgba?\(([^)]+)\)$/i.exec(color)
  if (!fnMatch)
    return null

  const body = fnMatch[1].trim()
  let rgbParts: string[]
  let alphaPart: string | undefined

  if (body.includes(',')) {
    const parts = body.split(',').map(p => p.trim())
    rgbParts = parts.slice(0, 3)
    alphaPart = parts[3]
  }
  else {
    const [rgbRaw, alphaRaw] = body.split('/')
    rgbParts = rgbRaw.trim().split(/\s+/)
    alphaPart = alphaRaw
  }

  if (rgbParts.length < 3)
    return null

  const r = parseColorChannel(rgbParts[0])
  const g = parseColorChannel(rgbParts[1])
  const b = parseColorChannel(rgbParts[2])
  const a = parseAlphaChannel(alphaPart)
  if (![r, g, b, a].every(Number.isFinite))
    return null

  return [r, g, b, a]
}

function computeLuma([r, g, b]: RgbTuple): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function compositeOver(base: RgbTuple, [fgR, fgG, fgB, alpha]: RgbaTuple): RgbTuple {
  if (alpha <= 0)
    return base
  if (alpha >= 1)
    return [fgR, fgG, fgB]
  const inv = 1 - alpha
  return [
    fgR * alpha + base[0] * inv,
    fgG * alpha + base[1] * inv,
    fgB * alpha + base[2] * inv,
  ]
}

function isEligibleBackdrop(el: Element | null, hasLayout: boolean, viewportW: number): el is HTMLElement {
  if (!(el instanceof HTMLElement))
    return false
  if (el.closest(IGNORED_SELECTOR))
    return false

  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden')
    return false
  if (Number.parseFloat(cs.opacity || '1') <= 0.05)
    return false

  const rect = el.getBoundingClientRect()
  if (rect.width > 0 || rect.height > 0)
    return rect.width >= viewportW * 0.5 && rect.top <= 48 && rect.bottom >= 16

  if (hasLayout)
    return false

  return el === document.body || el === document.documentElement || el.classList.contains('room-bg')
}

// 视图过渡（如切换亮暗主题时的扩散动画）期间，命中检测只返回根元素，读不到页面真正的背景
function isHitTestBlocked(): boolean {
  if (typeof document.elementsFromPoint !== 'function' || !document.body?.getBoundingClientRect().height)
    return false
  const stack = document.elementsFromPoint(Math.round(getViewportWidth() / 2), 28)
  return stack.length === 1 && stack[0] === document.documentElement
}

function collectBackdropCandidates(): HTMLElement[] {
  const viewportW = getViewportWidth()
  const docEl = document.documentElement
  const body = document.body
  const hasLayout = Boolean(docEl && docEl.clientHeight > 0 && window.innerWidth > 0 && body && body.getBoundingClientRect().height > 0)

  const ordered: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  const pushUnique = (el: Element | null) => {
    if (
      isEligibleBackdrop(el, hasLayout, viewportW)
      && el !== body
      && el !== docEl
      && !seen.has(el)
    ) {
      seen.add(el)
      ordered.push(el)
    }
  }

  if (hasLayout && typeof document.elementsFromPoint === 'function') {
    for (const ratio of [0.5, 0.15, 0.85]) {
      const x = Math.min(viewportW - 1, Math.max(0, Math.round(viewportW * ratio)))
      for (const el of document.elementsFromPoint(x, 28))
        pushUnique(el)
    }
  }

  for (const el of document.querySelectorAll('#room-background-vm .room-bg, .room-bg'))
    pushUnique(el)
  pushUnique(document.querySelector('.live-room-app'))

  if (isEligibleBackdrop(body, hasLayout, viewportW))
    ordered.push(body)
  if (isEligibleBackdrop(docEl, hasLayout, viewportW))
    ordered.push(docEl)

  return ordered
}

function getStripCacheKey(url: string): string {
  return `${Math.round(getViewportWidth() / 160)}:${url}`
}

function compositeSampleOverSolid(sampled: SampledStrip, solidUnderImage: RgbTuple): RgbTuple {
  const inv = 1 - sampled.alpha
  return [
    sampled.premulR + solidUnderImage[0] * inv,
    sampled.premulG + solidUnderImage[1] * inv,
    sampled.premulB + solidUnderImage[2] * inv,
  ]
}

async function sampleImageTopStrip(url: string): Promise<SampledStrip | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined')
    return null

  const viewportW = getViewportWidth()
  const cacheKey = getStripCacheKey(url)
  const cached = stripSampleCache.get(cacheKey)
  if (cached)
    return cached

  const loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    if (!/^(?:data|blob):/i.test(url))
      img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
  if (!loadedImg)
    return null

  if (typeof loadedImg.decode === 'function')
    await loadedImg.decode().catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_WIDTH
  canvas.height = SAMPLE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  try {
    const srcW = Math.max(1, loadedImg.naturalWidth || loadedImg.width || viewportW)
    const srcH = Math.min(
      Math.max(1, loadedImg.naturalHeight || loadedImg.height || 720),
      Math.max(1, Math.round(64 * (srcW / viewportW))),
    )
    ctx.drawImage(loadedImg, 0, 0, srcW, srcH, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
    const data = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data
    const pixelCount = data.length / 4
    if (pixelCount <= 0)
      return null

    let sumPremulR = 0
    let sumPremulG = 0
    let sumPremulB = 0
    let sumAlpha = 0

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255
      sumPremulR += data[i] * a
      sumPremulG += data[i + 1] * a
      sumPremulB += data[i + 2] * a
      sumAlpha += a
    }

    const result: SampledStrip = {
      premulR: sumPremulR / pixelCount,
      premulG: sumPremulG / pixelCount,
      premulB: sumPremulB / pixelCount,
      alpha: sumAlpha / pixelCount,
    }

    if (stripSampleCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = stripSampleCache.keys().next().value
      if (oldestKey !== undefined)
        stripSampleCache.delete(oldestKey)
    }
    stripSampleCache.set(cacheKey, result)
    return result
  }
  catch {
    return null
  }
}

export function useLiveTopBarForceWhite(): { forceWhiteIcon: Ref<boolean> } {
  const forceWhiteIcon = ref<boolean>(false)

  let latestToken = 0
  let lightDebounceTimer: ReturnType<typeof setTimeout> | undefined
  let imageDebounceTimer: ReturnType<typeof setTimeout> | undefined
  let attrObserver: MutationObserver | null = null
  let roomBgObserver: MutationObserver | null = null
  let structureObserver: MutationObserver | null = null
  let observedLiveRoomApp: Element | null = null
  let observedAppContent: Element | null = null
  let blockedFrame = 0
  let blockedFrameCount = 0

  function applyBackdropDark(nextDark: boolean) {
    clearTimeout(lightDebounceTimer)
    if (nextDark) {
      forceWhiteIcon.value = true
      return
    }
    if (forceWhiteIcon.value) {
      lightDebounceTimer = setTimeout(() => {
        forceWhiteIcon.value = false
      }, LIGHT_DEBOUNCE_MS)
    }
  }

  function evaluateBackdrop() {
    cancelAnimationFrame(blockedFrame)
    if (isHitTestBlocked() && blockedFrameCount < MAX_BLOCKED_FRAMES) {
      blockedFrameCount++
      blockedFrame = requestAnimationFrame(evaluateBackdrop)
      return
    }
    blockedFrameCount = 0

    const candidates = collectBackdropCandidates()

    let solid: RgbTuple = [255, 255, 255]
    let topImageUrl: string | null = null
    let solidUnderImage: RgbTuple = solid
    // 盖在最上面那张背景图之上的半透明色层，如原生暗色模式下压在房间壁纸上的`.room-bg::after`
    let layersAboveImage: RgbaTuple[] = []

    const paint = (rawColor: string) => {
      const color = parseCssColor(rawColor)
      if (!color || color[3] <= 0)
        return
      if (topImageUrl)
        layersAboveImage.push(color)
      else
        solid = compositeOver(solid, color)
    }

    for (const el of candidates.slice().reverse()) {
      const cs = getComputedStyle(el)
      paint(cs.backgroundColor)

      const imageUrl = extractBgImageUrl(cs.backgroundImage)
      if (imageUrl) {
        solid = layersAboveImage.reduce(compositeOver, solid)
        layersAboveImage = []
        topImageUrl = imageUrl
        solidUnderImage = solid
      }

      for (const pseudo of ['::before', '::after']) {
        const pseudoStyle = getComputedStyle(el, pseudo)
        if (pseudoStyle.content && pseudoStyle.content !== 'none' && pseudoStyle.content !== 'normal')
          paint(pseudoStyle.backgroundColor)
      }
    }

    const isDarkOver = (base: RgbTuple) =>
      computeLuma(layersAboveImage.reduce(compositeOver, base)) < DARK_LUMA_THRESHOLD

    if (!topImageUrl) {
      latestToken++
      clearTimeout(imageDebounceTimer)
      applyBackdropDark(isDarkOver(solid))
      return
    }

    const cached = stripSampleCache.get(getStripCacheKey(topImageUrl))
    if (cached) {
      latestToken++
      clearTimeout(imageDebounceTimer)
      applyBackdropDark(isDarkOver(compositeSampleOverSolid(cached, solidUnderImage)))
      return
    }

    clearTimeout(imageDebounceTimer)
    const token = ++latestToken
    const capturedUrl = topImageUrl
    const capturedSolid = solidUnderImage
    imageDebounceTimer = setTimeout(async () => {
      const sampled = await sampleImageTopStrip(capturedUrl)
      if (token !== latestToken)
        return

      applyBackdropDark(isDarkOver(sampled ? compositeSampleOverSolid(sampled, capturedSolid) : capturedSolid))
    }, IMAGE_DEBOUNCE_MS)
  }

  function bindRoomBgObserver() {
    roomBgObserver?.disconnect()
    roomBgObserver = null

    const vm = document.getElementById('room-background-vm')
    const roomBgs = vm ? [] : Array.from(document.querySelectorAll('.room-bg'))
    if (vm || roomBgs.length > 0) {
      roomBgObserver = new MutationObserver(evaluateBackdrop)
      if (vm) {
        roomBgObserver.observe(vm, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['style', 'class'],
        })
      }
      else {
        for (const el of roomBgs)
          roomBgObserver.observe(el, { attributes: true, attributeFilter: ['style', 'class'] })
      }
    }

    const liveRoomApp = document.querySelector('.live-room-app')
    if (liveRoomApp && liveRoomApp !== observedLiveRoomApp && structureObserver) {
      observedLiveRoomApp = liveRoomApp
      structureObserver.observe(liveRoomApp, { childList: true, subtree: false })
    }

    const appContent = document.querySelector('main.app-content')
    if (appContent && appContent !== observedAppContent && structureObserver) {
      observedAppContent = appContent
      structureObserver.observe(appContent, { childList: true, subtree: false })
    }
  }

  function handleStructureChange() {
    bindRoomBgObserver()
    evaluateBackdrop()
  }

  if (typeof document !== 'undefined' && document.body)
    evaluateBackdrop()

  onMounted(() => {
    attrObserver = new MutationObserver(evaluateBackdrop)
    attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
    if (document.body)
      attrObserver.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] })

    structureObserver = new MutationObserver(handleStructureChange)
    if (document.body)
      structureObserver.observe(document.body, { childList: true, subtree: false })

    bindRoomBgObserver()

    window.addEventListener('resize', evaluateBackdrop)
    window.addEventListener('popstate', evaluateBackdrop)
    window.addEventListener('hashchange', evaluateBackdrop)

    evaluateBackdrop()
  })

  onUnmounted(() => {
    latestToken++
    cancelAnimationFrame(blockedFrame)
    clearTimeout(lightDebounceTimer)
    clearTimeout(imageDebounceTimer)
    attrObserver?.disconnect()
    roomBgObserver?.disconnect()
    structureObserver?.disconnect()
    window.removeEventListener('resize', evaluateBackdrop)
    window.removeEventListener('popstate', evaluateBackdrop)
    window.removeEventListener('hashchange', evaluateBackdrop)
  })

  return { forceWhiteIcon }
}
