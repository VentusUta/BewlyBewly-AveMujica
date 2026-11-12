import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (changes: Record<string, { oldValue?: unknown, newValue?: unknown }>, areaName: string) => void

const { store, listeners, readKeys } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  listeners: [] as Listener[],
  readKeys: [] as string[],
}))

vi.mock('webextension-polyfill', () => {
  function notify(changes: Record<string, { oldValue?: unknown, newValue?: unknown }>) {
    // 与浏览器一样，在写入完成后异步通知所有frame
    setTimeout(() => listeners.forEach(fn => fn(structuredClone(changes), 'local')))
  }
  const browser = {
    runtime: { id: 'test-extension-id' },
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          readKeys.push(...[keys].flat())
          return Object.fromEntries(
            [keys].flat().filter(key => store.has(key)).map(key => [key, structuredClone(store.get(key))]),
          )
        },
        set: async (items: Record<string, unknown>) => {
          const changes: Record<string, { oldValue?: unknown, newValue?: unknown }> = {}
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: store.get(key), newValue: structuredClone(value) }
            store.set(key, structuredClone(value))
          }
          notify(changes)
        },
        remove: async (keys: string | string[]) => {
          const changes: Record<string, { oldValue?: unknown }> = {}
          for (const key of [keys].flat()) {
            if (!store.has(key))
              continue
            changes[key] = { oldValue: store.get(key) }
            store.delete(key)
          }
          notify(changes)
        },
      },
      onChanged: { addListener: (fn: Listener) => listeners.push(fn) },
    },
  }
  return { default: browser }
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

// 每次都重新导入模块并换一个pinia，相当于一个新的frame
async function openFrame() {
  vi.resetModules()
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const { useWallpaperStore } = await import('~/stores/wallpaperStore')
  return useWallpaperStore()
}

const IMAGE = 'data:image/jpeg;base64,AAAA'

describe('wallpaperStore', () => {
  beforeEach(() => {
    store.clear()
    listeners.length = 0
    readKeys.length = 0
  })

  it('returns URLs and inline data URLs unchanged without reading the stored wallpapers', async () => {
    const wallpaper = await openFrame()

    expect(wallpaper.resolve('')).toBe('')
    expect(wallpaper.resolve('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(wallpaper.resolve(IMAGE)).toBe(IMAGE)
    await flush()
    expect(readKeys).not.toContain('localWallpapers')
  })

  it('resolves a reference once the stored wallpaper is loaded', async () => {
    store.set('localWallpapers', { abc: IMAGE })
    const wallpaper = await openFrame()

    expect(wallpaper.resolve('bewly-local-wallpaper:abc')).toBe('')
    await flush()
    expect(wallpaper.resolve('bewly-local-wallpaper:abc')).toBe(IMAGE)
  })

  it('resolves a missing reference to an empty string', async () => {
    store.set('localWallpapers', { abc: IMAGE })
    const wallpaper = await openFrame()

    expect(wallpaper.resolve('bewly-local-wallpaper:def')).toBe('')
    await flush()
    expect(wallpaper.resolve('bewly-local-wallpaper:def')).toBe('')
  })

  it('follows wallpapers stored by another frame', async () => {
    const wallpaper = await openFrame()
    expect(wallpaper.resolve('bewly-local-wallpaper:abc')).toBe('')
    await flush()

    const { default: browser } = await import('webextension-polyfill')
    await browser.storage.local.set({ localWallpapers: { abc: IMAGE } })
    await flush()
    expect(wallpaper.resolve('bewly-local-wallpaper:abc')).toBe(IMAGE)
  })
})
