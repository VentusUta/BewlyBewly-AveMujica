import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { useWebFullscreen } from '~/composables/useWebFullscreen'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'

import ALink from '../components/ALink.vue'
import SearchBar from '../components/SearchBar/SearchBar.vue'
import LiveTopBar from '../components/TopBar/LiveTopBar.vue'
import MainTopBar from '../components/TopBar/MainTopBar.vue'
import { isHomePage, isLivePage } from '../utils/main'
import { testI18n } from './helpers/i18n'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getSearchSuggestion: vi.fn().mockResolvedValue({ code: 0, result: { tag: [] } }),
    getUserInfo: vi.fn().mockResolvedValue({
      code: 0,
      data: {
        mid: 10086,
        uname: 'AveMujica',
        face: 'https://i0.hdslb.com/bfs/face/test.jpg',
        vip: { status: 0 },
      },
    }),
    getTopBarNewMomentsCount: vi.fn().mockResolvedValue({ code: 0, data: { update_num: 0 } }),
    getUnreadMsg: vi.fn().mockResolvedValue({ code: 0, data: {} }),
    getUnreadDm: vi.fn().mockResolvedValue({ code: 0, data: { follow_unread: 0 } }),
    getWebAreaList: vi.fn().mockResolvedValue({ code: 0, data: { data: [] } }),
  },
}))

vi.mock('webextension-polyfill', () => {
  const store = new Map<string, string>()
  const listeners: Array<(changes: any, area: string) => void> = []
  const browser = {
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => path,
    },
    storage: {
      local: {
        get: async (key: string | string[]) => {
          if (Array.isArray(key))
            return Object.fromEntries(key.map(k => [k, store.get(k)]))
          return { [key]: store.get(key) }
        },
        set: async (items: Record<string, string>) => {
          for (const [k, v] of Object.entries(items))
            store.set(k, v)
        },
        remove: async (key: string) => {
          store.delete(key)
        },
      },
      onChanged: {
        addListener: (fn: (changes: any, area: string) => void) => listeners.push(fn),
      },
    },
  }
  return { default: browser, storage: browser.storage }
})

vi.mock('~/utils/api', () => ({
  default: {
    search: { getSearchSuggestion: apiMocks.getSearchSuggestion },
    user: { getUserInfo: apiMocks.getUserInfo },
    moment: { getTopBarNewMomentsCount: apiMocks.getTopBarNewMomentsCount },
    notification: {
      getUnreadMsg: apiMocks.getUnreadMsg,
      getUnreadDm: apiMocks.getUnreadDm,
    },
    live: { getWebAreaList: apiMocks.getWebAreaList },
  },
}))

vi.mock('~/components/SearchBar/searchHistoryProvider', () => ({
  addSearchHistory: vi.fn().mockResolvedValue([]),
  clearAllSearchHistory: vi.fn().mockResolvedValue([]),
  getSearchHistory: vi.fn().mockResolvedValue([]),
  removeSearchHistory: vi.fn().mockResolvedValue([]),
}))

const apps: App[] = []

function createMockAppProvider(): BewlyAppProvider {
  return {
    activatedPage: ref(AppPage.Home),
    reachTop: ref(true),
    mainAppRef: ref(document.createElement('div')),
    handlePageRefresh: ref(undefined),
    handleUndoRefresh: ref(undefined),
    handleForwardRefresh: ref(undefined),
    showUndoButton: ref(false),
    handleBackToTop: vi.fn(),
    openIframeDrawer: vi.fn(),
  }
}

const initialTheme = settings.value.theme

// jsdom doesn't compute styles for pseudo-elements
const afterPseudoStyles = new Map<Element, Partial<CSSStyleDeclaration>>()
const realGetComputedStyle = window.getComputedStyle.bind(window)

// The scrollbar component is loaded on demand, and fake timers can't wait for a real module load
beforeAll(async () => {
  await import('overlayscrollbars-vue')
})

beforeEach(() => {
  setActivePinia(createPinia())
  afterPseudoStyles.clear()
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => pseudo
    ? { content: 'none', ...(pseudo === '::after' ? afterPseudoStyles.get(el) : undefined) } as CSSStyleDeclaration
    : realGetComputedStyle(el))
})

afterEach(() => {
  vi.useRealTimers()
  settings.value.theme = initialTheme
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
  document.body.className = ''
  document.body.style.cssText = ''
  document.documentElement.className = ''
  document.documentElement.style.cssText = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isLivePage and isHomePage', () => {
  it.each([
    ['https://live.bilibili.com/', true],
    ['https://live.bilibili.com/2132670', true],
    ['https://live.bilibili.com/blanc/2132670', true],
    ['https://live.bilibili.com/p/eden/area-tags?parentAreaId=2', true],
    ['https://live.bilibili.com/en/2132670', true],
    ['https://live.bilibili.com/p/html/live-fansmedal-wall/index.html', false],
    ['https://live.bilibili.com/blackboard/xxx', false],
    ['https://live.bilibili.com/2132670?liteVersion=true', false],
    ['https://www.bilibili.com/', false],
    ['not a url', false],
  ])('evaluates isLivePage(%s) as %s', (url, expected) => {
    expect(isLivePage(url)).toBe(expected)
  })

  it('never treats live URLs as the main homepage', () => {
    expect(isHomePage('https://live.bilibili.com/')).toBe(false)
    expect(isHomePage('https://live.bilibili.com/2132670')).toBe(false)
    expect(isHomePage('https://live.bilibili.com/blanc/2132670')).toBe(false)
    expect(isHomePage('https://live.bilibili.com/p/eden/area-tags?parentAreaId=2')).toBe(false)
    expect(isHomePage('https://www.bilibili.com/')).toBe(true)
  })
})

describe('useWebFullscreen on live pages', () => {
  it('syncs isWebFullscreen with body.player-full-win class changes', async () => {
    vi.stubGlobal('location', new URL('https://live.bilibili.com/2132670'))

    let fullscreenRef!: ReturnType<typeof useWebFullscreen>['isWebFullscreen']
    const Probe = defineComponent({
      setup() {
        const { isWebFullscreen } = useWebFullscreen()
        fullscreenRef = isWebFullscreen
        return () => h('div')
      },
    })

    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(Probe)
    app.mount(container)
    apps.push(app)

    await nextTick()
    expect(fullscreenRef.value).toBe(false)

    document.body.classList.add('player-full-win')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(fullscreenRef.value).toBe(true)

    document.body.classList.remove('player-full-win')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(fullscreenRef.value).toBe(false)
  })

  it('reads initial player-full-win state on mount', async () => {
    vi.stubGlobal('location', new URL('https://live.bilibili.com/blanc/2132670'))
    document.body.classList.add('player-full-win')

    let fullscreenRef!: ReturnType<typeof useWebFullscreen>['isWebFullscreen']
    const Probe = defineComponent({
      setup() {
        const { isWebFullscreen } = useWebFullscreen()
        fullscreenRef = isWebFullscreen
        return () => h('div')
      },
    })

    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(Probe)
    app.mount(container)
    apps.push(app)

    await nextTick()
    expect(fullscreenRef.value).toBe(true)
  })
})

describe('searchBar searchType', () => {
  function mountSearchBar(searchType?: 'all' | 'live') {
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp({
      render: () => h(SearchBar, searchType ? { searchType } : {}),
    })
    app.use(testI18n)
    app.provide('BEWLY_APP', createMockAppProvider())
    app.mount(container)
    apps.push(app)
    return container
  }

  it('opens live search URL when searchType is live', async () => {
    const openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    const container = mountSearchBar('live')
    await nextTick()

    const input = container.querySelector('input')!
    input.value = '虚拟主播'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()

    expect(openSpy).toHaveBeenCalledWith('//search.bilibili.com/live?keyword=%E8%99%9A%E6%8B%9F%E4%B8%BB%E6%92%AD', '_blank')
  })

  it('opens main search URL by default', async () => {
    const openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    const container = mountSearchBar()
    await nextTick()

    const input = container.querySelector('input')!
    input.value = 'bilibili'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()

    expect(openSpy).toHaveBeenCalledWith('//search.bilibili.com/all?keyword=bilibili', '_blank')
  })
})

describe('liveTopBar', () => {
  const flushPromises = () => new Promise(resolve => setTimeout(resolve))

  function mountLiveTopBar() {
    vi.stubGlobal('location', new URL('https://live.bilibili.com/2132670'))

    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp({
      render: () => h(LiveTopBar),
    })
    app.use(createPinia())
    app.use(testI18n)
    app.component('ALink', ALink)
    app.component('SearchBar', SearchBar)
    app.provide('BEWLY_APP', createMockAppProvider())
    app.mount(container)
    apps.push(app)
    return container
  }

  it('renders live navigation links, search bar, and places avatar last when logged in', async () => {
    apiMocks.getUserInfo.mockResolvedValueOnce({
      code: 0,
      data: {
        mid: 10086,
        uname: 'AveMujica',
        face: 'https://i0.hdslb.com/bfs/face/test.jpg',
        vip: { status: 0 },
      },
    })

    const container = mountLiveTopBar()
    await flushPromises()
    await nextTick()

    const logoLink = container.querySelector<HTMLAnchorElement>('a.logo')
    expect(logoLink).not.toBeNull()
    expect(logoLink!.getAttribute('href')).toBe('https://live.bilibili.com')

    const others = container.querySelector<HTMLElement>('.top-bar-nav .nav-items')
    expect(others).not.toBeNull()
    expect(others!.querySelector('.login')).toBeNull()

    const desktopItems = others!.firstElementChild!
    expect(desktopItems.querySelector('a[href="https://t.bilibili.com"]')).not.toBeNull()
    expect(desktopItems.querySelector('a[href="https://link.bilibili.com/p/center/index#/user-center/follow/1"]')).not.toBeNull()

    const startStreamingLink = desktopItems.querySelector<HTMLAnchorElement>(
      'a[href="https://link.bilibili.com/p/center/index#/my-room/start-live"]',
    )
    expect(startStreamingLink).not.toBeNull()
    expect(startStreamingLink!.getAttribute('target')).toBe('_blank')
    expect(startStreamingLink!.classList.contains('accent')).toBe(true)

    expect(desktopItems.querySelector('a div[i-tabler\\:bell]')).not.toBeNull()

    const moreItems = others!.querySelector(':scope > .nav-item .bew-popover')!
    expect(moreItems.querySelector('a[href="https://message.bilibili.com"]')).not.toBeNull()
    expect(moreItems.querySelector('a[href="https://t.bilibili.com/"]')).not.toBeNull()
    expect(moreItems.querySelector('a[href="https://link.bilibili.com/p/center/index#/user-center/follow/1"]')).not.toBeNull()
    expect(
      moreItems.querySelector('a[href="https://link.bilibili.com/p/center/index#/my-room/start-live"][target="_blank"]'),
    ).not.toBeNull()

    const avatarItem = others!.lastElementChild
    expect(avatarItem).not.toBeNull()
    expect(avatarItem!.classList.contains('avatar')).toBe(true)

    const openSpy = vi.fn()
    vi.stubGlobal('open', openSpy)
    const searchInput = container.querySelector<HTMLInputElement>('header input')!
    searchInput.value = 'AveMujica'
    searchInput.dispatchEvent(new Event('input'))
    await nextTick()
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(openSpy).toHaveBeenCalledWith('//search.bilibili.com/live?keyword=AveMujica', '_blank')
  })

  it('shows sign-in link and hides avatar when logged out', async () => {
    apiMocks.getUserInfo.mockResolvedValueOnce({ code: -101 })

    const container = mountLiveTopBar()
    await flushPromises()
    await nextTick()

    const others = container.querySelector<HTMLElement>('.top-bar-nav .nav-items')!
    expect(others.querySelector('a.login[href="https://passport.bilibili.com/login"]')).not.toBeNull()
    expect(others.querySelector('.avatar')).toBeNull()
  })

  it('renders LiveTopBar on live pages and MainTopBar otherwise via isLivePage()', async () => {
    const mountTopBar = (url: string) => {
      vi.stubGlobal('location', new URL(url))
      const container = document.createElement('div')
      document.body.append(container)
      const app = createApp({ render: () => h(isLivePage() ? LiveTopBar : MainTopBar) })
      app.use(createPinia())
      app.use(testI18n)
      app.component('ALink', ALink)
      app.component('SearchBar', SearchBar)
      app.provide('BEWLY_APP', createMockAppProvider())
      app.mount(container)
      apps.push(app)
      return container
    }

    const liveContainer = mountTopBar('https://live.bilibili.com/2132670')
    await flushPromises()
    await nextTick()
    expect(liveContainer.querySelector('a.logo')!.getAttribute('href')).toBe('https://live.bilibili.com')
    expect(liveContainer.querySelector('a[href="https://link.bilibili.com/p/center/index#/user-center/follow/1"]')).not.toBeNull()

    const videoContainer = mountTopBar('https://www.bilibili.com/video/BV1GJ411x7h7/')
    await flushPromises()
    await nextTick()
    expect(videoContainer.querySelector('a.logo')!.getAttribute('href')).toBe('//www.bilibili.com')
    expect(videoContainer.querySelector('a[href="https://link.bilibili.com/p/center/index#/user-center/follow/1"]')).toBeNull()
  })

  it('renders only back_to_main and live_rank in LiveChannelsPop quick-nav', async () => {
    vi.useFakeTimers()
    apiMocks.getWebAreaList.mockResolvedValueOnce({ code: 0, data: null })

    const container = mountLiveTopBar()
    await vi.advanceTimersByTimeAsync(1)
    await nextTick()

    const logoContainer = container.querySelector('a.logo')!.parentElement!
    logoContainer.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(360)
    await nextTick()

    const quickNavLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('.quick-nav a'))
    expect(quickNavLinks).toHaveLength(2)
    expect(quickNavLinks[0].getAttribute('href')).toBe('https://www.bilibili.com')
    expect(quickNavLinks[0].getAttribute('target')).toBe('_top')
    expect(quickNavLinks[1].getAttribute('href')).toBe('https://live.bilibili.com/p/eden/rank')
    expect(container.querySelector('.quick-nav a[href="https://live.bilibili.com/p/eden/area-tags"]')).toBeNull()
    expect(container.querySelector('.quick-nav a[href="https://live.bilibili.com"]')).toBeNull()
  })

  it('falls back to the built-in parent areas when the area list request fails', async () => {
    vi.useFakeTimers()
    apiMocks.getWebAreaList.mockResolvedValueOnce({ code: -1 })

    const container = mountLiveTopBar()
    await vi.advanceTimersByTimeAsync(1)
    await nextTick()

    const logoContainer = container.querySelector('a.logo')!.parentElement!
    logoContainer.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(360)
    await nextTick()

    const hrefs = Array.from(container.querySelectorAll<HTMLAnchorElement>('.link-list a'), a => a.getAttribute('href'))
    expect(hrefs).toHaveLength(13)
    expect(hrefs[0]).toBe('https://live.bilibili.com/p/eden/area-tags?parentAreaId=2&areaId=0')
    expect(hrefs).toContain('https://live.bilibili.com/p/html/play-together-area/index.html?parentAreaId=301&areaId=0')
    expect(container.querySelector('.link-list [i-mingcute\\:right-line]')).toBeNull()
  })

  it('takes parent areas from the API, then shows pure-text floating sub-area menu after hover intent and preserves it when grazing neighbors', async () => {
    vi.useFakeTimers()
    apiMocks.getWebAreaList.mockResolvedValueOnce({
      code: 0,
      data: {
        data: [
          { id: 999, name: '新分区', list: [] },
          {
            id: 2,
            name: '网游',
            list: [
              { id: '86', parent_id: '2', name: '英雄联盟', pic: 'https://i0.hdslb.com/bfs/live/lol.png' },
              { id: '329', parent_id: '2', name: '无畏契约', pic: 'https://i0.hdslb.com/bfs/live/val.png' },
            ],
          },
          {
            id: 3,
            name: '手游',
            list: [
              { id: '35', parent_id: '3', name: '王者荣耀', pic: 'https://i0.hdslb.com/bfs/live/hok.png' },
              { id: '98', parent_id: '3', name: '原神', pic: 'https://i0.hdslb.com/bfs/live/ys.png' },
            ],
          },
        ],
      },
    })

    const container = mountLiveTopBar()
    await vi.advanceTimersByTimeAsync(1)
    await nextTick()

    const logoContainer = container.querySelector('a.logo')!.parentElement!
    logoContainer.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(360)
    await nextTick()

    const parentLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('.link-list a'))
    expect(parentLinks.map(a => new URL(a.href).searchParams.get('parentAreaId'))).toEqual(['999', '2', '3'])
    expect(parentLinks[0].textContent).toContain('新分区')

    const onlineGamesLi = container.querySelector('a[href*="parentAreaId=2&"]')!.closest('li')!
    const mobileGamesLi = container.querySelector('a[href*="parentAreaId=3&"]')!.closest('li')!

    onlineGamesLi.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(95)
    await nextTick()

    const subMenu = container.querySelector('.sub-area-menu')!
    expect(subMenu).not.toBeNull()
    expect(subMenu.querySelectorAll('img')).toHaveLength(0)
    expect((subMenu.querySelector('.sub-area-list') as HTMLElement).style.gridTemplateColumns).toBe('')
    expect(subMenu.querySelector('a[href*="parentAreaId=2&areaId=86"]')?.textContent).toContain('英雄联盟')

    // Simulate brief diagonal graze over neighbor (40ms < 90ms hover-intent delay) into .sub-area-menu
    onlineGamesLi.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }))
    mobileGamesLi.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(40)
    mobileGamesLi.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }))
    subMenu.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    await vi.advanceTimersByTimeAsync(150)
    await nextTick()

    expect(container.querySelector('.sub-area-menu a[href*="parentAreaId=2&areaId=86"]')).not.toBeNull()
    expect(container.querySelector('.sub-area-menu a[href*="parentAreaId=3&"]')).toBeNull()
  })

  it('applies force-white-icon immediately on pre-existing dark body and light-to-dark switch while debouncing dark-to-light', async () => {
    vi.useFakeTimers()
    document.body.style.backgroundColor = 'rgb(0, 2, 32)'

    // Pre-existing dark activity background (e.g. live.bilibili.com/6) should render dark-ready immediately at 0ms
    const darkContainer = mountLiveTopBar()
    await nextTick()
    expect(darkContainer.querySelector('header')!.classList.contains('force-white-icon')).toBe(true)

    // Switch back to a light room background inside an intermediate flash -> stays true during 180ms hysteresis, then turns false
    document.body.style.backgroundColor = 'rgb(241, 242, 243)'
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(darkContainer.querySelector('header')!.classList.contains('force-white-icon')).toBe(true)

    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(darkContainer.querySelector('header')!.classList.contains('force-white-icon')).toBe(false)

    // Light -> dark transition applies immediately on microtask without waiting for timer advance
    document.body.style.backgroundColor = 'rgb(0, 2, 32)'
    await Promise.resolve()
    await nextTick()
    expect(darkContainer.querySelector('header')!.classList.contains('force-white-icon')).toBe(true)
  })

  it('counts a dark overlay above a light backdrop, like the native dark mode veil on room wallpapers', async () => {
    document.body.style.backgroundColor = 'rgb(241, 242, 243)'
    afterPseudoStyles.set(document.body, { content: '""', backgroundColor: 'rgba(28, 32, 34, 0.85)' })

    const container = mountLiveTopBar()
    await nextTick()
    expect(container.querySelector('header')!.classList.contains('force-white-icon')).toBe(true)
  })

  it('waits until a view transition stops blocking hit-testing before judging the backdrop', async () => {
    vi.useFakeTimers()
    document.body.style.backgroundColor = 'rgb(10, 11, 12)'
    vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1280, 900))
    let stack: Element[] = [document.documentElement]
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => stack })

    try {
      const container = mountLiveTopBar()
      await vi.advanceTimersByTimeAsync(50)
      await nextTick()
      const header = container.querySelector('header')!
      expect(header.classList.contains('force-white-icon')).toBe(false)

      stack = [document.body, document.documentElement]
      await vi.advanceTimersByTimeAsync(50)
      await nextTick()
      expect(header.classList.contains('force-white-icon')).toBe(true)
    }
    finally {
      Reflect.deleteProperty(document, 'elementsFromPoint')
    }
  })

  it('debounces multi-stage room-bg changes and switches force-white-icon by sampled top-strip luminance', async () => {
    vi.useFakeTimers()

    let lastDrawnSrc = ''
    class MockImage {
      crossOrigin = ''
      naturalWidth = 1920
      naturalHeight = 1080
      width = 1920
      height = 1080
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''

      get src() {
        return this._src
      }

      set src(value: string) {
        this._src = value
        queueMicrotask(() => this.onload?.())
      }

      decode() {
        return Promise.resolve()
      }
    }

    vi.stubGlobal('Image', MockImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      drawImage: (img: { src?: string }) => {
        lastDrawnSrc = img?.src ?? ''
      },
      getImageData: (_x: number, _y: number, w: number, h: number) => {
        const isDark = lastDrawnSrc.includes('dark-skin')
        const [r, g, b] = isDark ? [18, 24, 42] : [215, 224, 210]
        const data = new Uint8ClampedArray(w * h * 4)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
          data[i + 3] = 255
        }
        return { data }
      },
    }) as unknown as CanvasRenderingContext2D)

    document.body.style.backgroundColor = 'rgb(241, 242, 243)'
    const container = mountLiveTopBar()
    await nextTick()

    const vm = document.createElement('div')
    vm.id = 'room-background-vm'
    const roomBg = document.createElement('div')
    roomBg.className = 'room-bg webp p-fixed'
    roomBg.style.backgroundImage = 'url("//i0.hdslb.com/bfs/live/light-ssr.webp")'
    vm.append(roomBg)
    document.body.append(vm)

    // Coalesce rapid Stage 1 -> Stage 2 -> Stage 3 changes within 50ms image debounce window
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(20)
    roomBg.style.backgroundImage = 'none'
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(20)
    roomBg.style.backgroundImage = 'url("//i0.hdslb.com/bfs/live/dark-skin.webp")'
    await Promise.resolve()
    await nextTick()

    const header = container.querySelector('header')!
    expect(header.classList.contains('force-white-icon')).toBe(false)

    // 50ms image debounce + decode switches dark skin on immediately
    await vi.advanceTimersByTimeAsync(60)
    await Promise.resolve()
    await nextTick()
    expect(header.classList.contains('force-white-icon')).toBe(true)

    // Switching to a light wallpaper waits for 50ms image debounce + 180ms light hysteresis before turning off
    roomBg.style.backgroundImage = 'url("//i0.hdslb.com/bfs/live/light-wallpaper.webp")'
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(80)
    await Promise.resolve()
    await nextTick()
    expect(header.classList.contains('force-white-icon')).toBe(true)

    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    await nextTick()
    expect(header.classList.contains('force-white-icon')).toBe(false)
  })

  it('uses force-light-bar instead of dark var(--bew-bg) mask on white live homepage in dark mode', async () => {
    vi.useFakeTimers()
    settings.value.theme = 'dark'
    document.body.style.backgroundColor = 'rgb(255, 255, 255)'

    const container = mountLiveTopBar()
    await nextTick()

    const header = container.querySelector('header')!
    expect(header.classList.contains('force-light-bar')).toBe(true)
    expect(header.classList.contains('force-white-icon')).toBe(false)

    const maskGradient = header.querySelector<HTMLElement>('main > div')!.style.background
    expect(maskGradient).not.toContain('--bew-bg')

    // Navigating or switching to a dark background clears force-light-bar and activates force-white-icon
    document.body.style.backgroundColor = 'rgb(0, 2, 32)'
    await Promise.resolve()
    await nextTick()
    expect(header.classList.contains('force-white-icon')).toBe(true)
    expect(header.classList.contains('force-light-bar')).toBe(false)
  })
})
