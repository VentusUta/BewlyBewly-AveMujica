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
const OTHER_IMAGE = 'data:image/jpeg;base64,BBBB'

function wallpaperSettings(wallpaper: string, searchPageWallpaper = '', uploaded: string | null = null) {
  return {
    wallpaper,
    searchPageWallpaper,
    locallyUploadedWallpaper: uploaded === null ? null : { name: 'a.jpg', url: uploaded },
  }
}

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

  it('stores each image once under its content hash', async () => {
    const wallpaper = await openFrame()

    const ref = await wallpaper.save(IMAGE)
    expect(ref).toMatch(/^bewly-local-wallpaper:[0-9a-f]{16}$/)
    expect(await wallpaper.save(IMAGE)).toBe(ref)
    expect(store.get('localWallpapers')).toEqual({ [ref.split(':')[1]]: IMAGE })
    expect(wallpaper.resolve(ref)).toBe(IMAGE)
  })

  it('prunes the images that are no longer in use', async () => {
    const wallpaper = await openFrame()
    const first = await wallpaper.save(IMAGE)
    const second = await wallpaper.save(OTHER_IMAGE)

    await wallpaper.prune(['', first, second])
    expect(Object.keys(store.get('localWallpapers') as object)).toHaveLength(2)

    await wallpaper.prune(['https://example.com/a.jpg', second])
    expect(store.get('localWallpapers')).toEqual({ [second.split(':')[1]]: OTHER_IMAGE })

    await wallpaper.prune([])
    expect(store.has('localWallpapers')).toBe(false)
  })

  it('keeps wallpapers stored by another frame when saving', async () => {
    const frameA = await openFrame()
    const first = await frameA.save(IMAGE)
    await flush()

    const frameB = await openFrame()
    const second = await frameB.save(OTHER_IMAGE)
    await flush()

    expect(Object.keys(store.get('localWallpapers') as object).sort())
      .toEqual([first, second].map(ref => ref.split(':')[1]).sort())
    expect(frameA.resolve(second)).toBe(OTHER_IMAGE)
  })
})

describe('wallpapers in settings', () => {
  beforeEach(() => {
    store.clear()
    listeners.length = 0
    readKeys.length = 0
  })

  // 与store共用同一个frame的模块实例和pinia
  async function openSettingsFrame() {
    const wallpaper = await openFrame()
    return { wallpaper, ...await import('~/logic/wallpaper') }
  }

  it('moves inline wallpapers out of settings and restores them for export', async () => {
    const { inlineLocalWallpapers, storeInlineWallpapers } = await openSettingsFrame()
    const original = wallpaperSettings(IMAGE, 'https://example.com/a.jpg', IMAGE)

    const stored = await storeInlineWallpapers(original)
    expect(stored.wallpaper).toMatch(/^bewly-local-wallpaper:/)
    expect(stored.locallyUploadedWallpaper?.url).toBe(stored.wallpaper)
    expect(stored.searchPageWallpaper).toBe('https://example.com/a.jpg')
    expect(Object.keys(store.get('localWallpapers') as object)).toHaveLength(1)
    expect(JSON.stringify(stored).length).toBeLessThan(200)

    expect(await inlineLocalWallpapers(stored)).toEqual(original)
  })

  it('restores wallpapers for export in a frame that has not shown them yet', async () => {
    const first = await openSettingsFrame()
    const stored = await first.storeInlineWallpapers(wallpaperSettings(IMAGE))
    await flush()

    const { inlineLocalWallpapers } = await openSettingsFrame()
    expect((await inlineLocalWallpapers(stored)).wallpaper).toBe(IMAGE)
  })

  it('leaves settings without inline wallpapers untouched', async () => {
    const { storeInlineWallpapers } = await openSettingsFrame()
    const original = wallpaperSettings('https://example.com/a.jpg')

    expect(await storeInlineWallpapers(original)).toBe(original)
    expect(store.has('localWallpapers')).toBe(false)
  })

  it('prunes the wallpapers that settings no longer reference', async () => {
    const { wallpaper, pruneLocalWallpapers } = await openSettingsFrame()
    const first = await wallpaper.save(IMAGE)
    const second = await wallpaper.save(OTHER_IMAGE)

    await pruneLocalWallpapers(wallpaperSettings('', first, second))
    expect(Object.keys(store.get('localWallpapers') as object)).toHaveLength(2)

    await pruneLocalWallpapers(wallpaperSettings('', '', second))
    expect(store.get('localWallpapers')).toEqual({ [second.split(':')[1]]: OTHER_IMAGE })

    await pruneLocalWallpapers(wallpaperSettings('https://example.com/a.jpg'))
    expect(store.has('localWallpapers')).toBe(false)
  })
})
