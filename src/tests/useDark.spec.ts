import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { getCookie, setCookie } from '~/utils/main'

const storageStore = new Map<string, string>()
const pendingStorageReads: Array<{ key: string | string[], resolve: (value: Record<string, unknown>) => void }> = []
let deferStorageGet = false

function readFromStore(key: string | string[]): Record<string, unknown> {
  if (Array.isArray(key))
    return Object.fromEntries(key.map(k => [k, storageStore.get(k)]))
  return { [key]: storageStore.get(key) }
}

vi.mock('webextension-polyfill', () => {
  const listeners: Array<(changes: any, area: string) => void> = []
  const browser = {
    runtime: { id: 'test-extension-id' },
    storage: {
      local: {
        get: (key: string | string[]) => {
          if (deferStorageGet) {
            return new Promise<Record<string, unknown>>((resolve) => {
              pendingStorageReads.push({ key, resolve })
            })
          }
          return Promise.resolve(readFromStore(key))
        },
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items))
            storageStore.set(k, v as string)
        },
        remove: async (key: string) => {
          storageStore.delete(key)
        },
      },
      onChanged: {
        addListener: (fn: (changes: any, area: string) => void) => listeners.push(fn),
      },
    },
  }
  return { default: browser, storage: browser.storage }
})

function clearTestCookies() {
  for (const name of ['theme_style', 'foo'])
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

describe('getCookie and setCookie with duplicate cookies', () => {
  afterEach(() => {
    clearTestCookies()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the last cookie value when duplicate names exist', () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('theme_style=light; foo=1; theme_style=dark')
    expect(getCookie('theme_style')).toBe('dark')
  })

  it('clears host-only subdomain cookie before writing .bilibili.com cookie', () => {
    const writes: string[] = []
    vi.stubGlobal('location', new URL('https://live.bilibili.com/'))
    vi.spyOn(document, 'cookie', 'set').mockImplementation((val: string) => {
      writes.push(val)
    })

    setCookie('theme_style', 'dark', 365)

    expect(writes.length).toBe(2)
    expect(writes[0]).toContain('theme_style=;')
    expect(writes[0]).toContain('expires=Thu, 01 Jan 1970')
    expect(writes[0]).not.toContain('domain=')
    expect(writes[1]).toContain('theme_style=dark;')
    expect(writes[1]).toContain('domain=.bilibili.com;')
  })
})

describe('useDark Safari document_start and async settings regression', () => {
  const originalReadyState = Object.getOwnPropertyDescriptor(Document.prototype, 'readyState')

  beforeEach(() => {
    vi.resetModules()
    storageStore.clear()
    pendingStorageReads.length = 0
    deferStorageGet = false
    clearTestCookies()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-bewly-theme')
  })

  afterEach(() => {
    if (originalReadyState)
      Object.defineProperty(document, 'readyState', originalReadyState)
    deferStorageGet = false
    pendingStorageReads.length = 0
    clearTestCookies()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-bewly-theme')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps dark theme_style cookie intact at document_start when Safari matchMedia initially returns false and flips at DOMContentLoaded', async () => {
    document.cookie = 'theme_style=dark; path=/'

    let readyState: DocumentReadyState = 'loading'
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyState,
    })

    let systemDark = false
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      media: query,
      matches: query.includes('prefers-color-scheme: dark') ? systemDark : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    const originalCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
    const cookieWrites: string[] = []
    vi.spyOn(document, 'cookie', 'set').mockImplementation((val: string) => {
      cookieWrites.push(val)
      originalCookieDesc.set!.call(document, val)
    })

    const { settings } = await import('~/logic')
    const { useDark } = await import('~/composables/useDark')

    const { isDark } = useDark()
    expect(isDark.value).toBe(true)
    expect(document.documentElement.getAttribute('data-bewly-theme')).toBe('dark')
    expect(getCookie('theme_style')).toBe('dark')
    expect(cookieWrites.some(w => w.includes('theme_style=light'))).toBe(false)

    await settings.ready
    await nextTick()

    // Still loading and matchMedia still returning false before DOMContentLoaded: must not clobber cookie
    expect(isDark.value).toBe(true)
    expect(getCookie('theme_style')).toBe('dark')
    expect(cookieWrites.some(w => w.includes('theme_style=light'))).toBe(false)

    // WebKit finishes parsing DOM; matchMedia now reflects macOS dark mode without firing a 'change' event
    systemDark = true
    readyState = 'interactive'
    document.dispatchEvent(new Event('DOMContentLoaded'))
    await nextTick()

    expect(isDark.value).toBe(true)
    expect(document.documentElement.getAttribute('data-bewly-theme')).toBe('dark')
    expect(getCookie('theme_style')).toBe('dark')
    expect(cookieWrites.some(w => w.includes('theme_style=light'))).toBe(false)
  })

  it('preserves manual dark setting on Light OS before settings.ready resolves at document_start', async () => {
    document.cookie = 'theme_style=dark; path=/'
    storageStore.set('settings', JSON.stringify({ theme: 'dark', adaptToOtherPageStyles: true }))
    deferStorageGet = true

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'loading' as DocumentReadyState,
    })

    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      media: query,
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    const originalCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
    const cookieWrites: string[] = []
    vi.spyOn(document, 'cookie', 'set').mockImplementation((val: string) => {
      cookieWrites.push(val)
      originalCookieDesc.set!.call(document, val)
    })

    const { settings } = await import('~/logic')
    const { useDark } = await import('~/composables/useDark')

    const { isDark } = useDark()
    expect(isDark.value).toBe(true)
    expect(getCookie('theme_style')).toBe('dark')
    expect(cookieWrites.some(w => w.includes('theme_style=light'))).toBe(false)

    for (const pending of pendingStorageReads.splice(0))
      pending.resolve(readFromStore(pending.key))
    await settings.ready
    await nextTick()

    expect(isDark.value).toBe(true)
    expect(document.documentElement.getAttribute('data-bewly-theme')).toBe('dark')
    expect(getCookie('theme_style')).toBe('dark')
    expect(cookieWrites.some(w => w.includes('theme_style=light'))).toBe(false)
  })
})
