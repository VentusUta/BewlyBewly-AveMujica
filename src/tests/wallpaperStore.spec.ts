import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (changes: Record<string, { oldValue?: unknown, newValue?: unknown }>, areaName: string) => void

const { store, listeners, readKeys, setCalls, quota, settingsRead } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  listeners: [] as Listener[],
  readKeys: [] as string[],
  setCalls: [] as string[][],
  // `safari`为真时按Safari有缺陷的方式计算配额
  quota: { bytes: Infinity, safari: false },
  // 设为一个promise时，读取`settings`要等它完成，用来让几个frame同时读到旧值
  settingsRead: { gate: undefined as Promise<void> | undefined },
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
          if ([keys].flat().includes('settings'))
            await settingsRead.gate
          return Object.fromEntries(
            [keys].flat().filter(key => store.has(key)).map(key => [key, structuredClone(store.get(key))]),
          )
        },
        set: async (items: Record<string, unknown>) => {
          setCalls.push(Object.keys(items))
          if (quota.safari) {
            // Safari（https://bugs.webkit.org/show_bug.cgi?id=331322）：现有总量按字符数算，
            // 新值和被替换的旧值按字节算（含Latin-1以外字符的值每字符2字节），相减为负即视为超限
            const bytes = (value: unknown) => {
              const json = JSON.stringify(value)
              return json.length * (/[\u0100-\uFFFF]/.test(json) ? 2 : 1)
            }
            const existing = [...store].reduce((sum, [key, value]) => sum + key.length + JSON.stringify(value).length, 0)
            const added = Object.entries(items).reduce((sum, [key, value]) => sum + key.length + bytes(value), 0)
            const replaced = Object.keys(items).filter(key => store.has(key)).reduce((sum, key) => sum + key.length + bytes(store.get(key)), 0)
            const total = existing + added - replaced
            if (total < 0 || total > quota.bytes)
              throw new Error('Invalid call to browser.storage.local.set(). Exceeded storage quota.')
          }
          else {
            // 与Chrome一样，按整次写入之后的总量计算配额，超出时一个键都不写
            const after = new Map([...store, ...Object.entries(items)])
            const total = [...after].reduce((sum, [key, value]) => sum + key.length + JSON.stringify(value).length, 0)
            if (total > quota.bytes)
              throw new Error('QUOTA_BYTES quota exceeded')
          }
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
    setCalls.length = 0
    quota.bytes = Infinity
    quota.safari = false
    settingsRead.gate = undefined
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
    setCalls.length = 0
    quota.bytes = Infinity
    quota.safari = false
    settingsRead.gate = undefined
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

describe('migrating inline wallpapers', () => {
  const legacySettings = {
    wallpaper: IMAGE,
    enableWallpaperMasking: false,
    searchPageWallpaper: OTHER_IMAGE,
    locallyUploadedWallpaper: { name: 'a.jpg', url: OTHER_IMAGE },
  }

  beforeEach(() => {
    store.clear()
    listeners.length = 0
    readKeys.length = 0
    setCalls.length = 0
    quota.bytes = Infinity
    quota.safari = false
    settingsRead.gate = undefined
  })

  // 入口先激活pinia，设置随后才读取
  async function openSettingsFrame() {
    const wallpaper = await openFrame()
    return { wallpaper, ...await import('~/logic') }
  }

  function storedSettings() {
    return JSON.parse(store.get('settings') as string)
  }

  function storageBytes() {
    return [...store].reduce((sum, [key, value]) => sum + key.length + JSON.stringify(value).length, 0)
  }

  it('moves inline wallpapers out of stored settings in a single write', async () => {
    store.set('settings', JSON.stringify(legacySettings))
    const { settings, wallpaper } = await openSettingsFrame()

    await settings.ready
    expect(settings.value.wallpaper).toMatch(/^bewly-local-wallpaper:/)
    expect(setCalls.filter(keys => keys.includes('settings') || keys.includes('localWallpapers')))
      .toEqual([['localWallpapers', 'settings']])

    const stored = storedSettings()
    expect(Object.keys(stored)).toEqual(Object.keys(legacySettings))
    expect(stored.wallpaper).toBe(settings.value.wallpaper)
    expect(stored.enableWallpaperMasking).toBe(false)
    expect(stored.locallyUploadedWallpaper).toEqual({ name: 'a.jpg', url: stored.searchPageWallpaper })
    expect(Object.keys(store.get('localWallpapers') as object)).toHaveLength(2)

    await flush()
    expect(wallpaper.resolve(stored.wallpaper)).toBe(IMAGE)
    expect(wallpaper.resolve(stored.searchPageWallpaper)).toBe(OTHER_IMAGE)
  })

  it('fits in the quota the old settings already used', async () => {
    // 引用比这里的小图片还长，换成接近真实比例的大图片
    const first = `data:image/jpeg;base64,${'A'.repeat(4000)}`
    const second = `data:image/jpeg;base64,${'B'.repeat(4000)}`
    store.set('settings', JSON.stringify({ ...legacySettings, wallpaper: first, searchPageWallpaper: second, locallyUploadedWallpaper: { name: 'a.jpg', url: second } }))
    const before = storageBytes()
    // 余量只够再放一张：先存两张图片、再改设置的做法在这里会失败
    quota.bytes = before + first.length
    const { settings } = await openSettingsFrame()

    await settings.ready
    expect(settings.value.wallpaper).toMatch(/^bewly-local-wallpaper:/)
    expect(storedSettings().wallpaper).toBe(settings.value.wallpaper)
    expect(Object.values(store.get('localWallpapers') as object).sort()).toEqual([first, second])
    expect(storageBytes()).toBeLessThan(before)
  })

  it('gives the same result when several frames migrate at once', async () => {
    store.set('settings', JSON.stringify(legacySettings))
    let release = () => {}
    settingsRead.gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const frameA = await openSettingsFrame()
    const frameB = await openSettingsFrame()
    release()

    await Promise.all([frameA.settings.ready, frameB.settings.ready])
    await flush()
    expect(setCalls.filter(keys => keys.includes('settings'))).toEqual([['localWallpapers', 'settings'], ['localWallpapers', 'settings']])
    expect(frameA.settings.value.wallpaper).toMatch(/^bewly-local-wallpaper:/)
    expect(frameB.settings.value.wallpaper).toBe(frameA.settings.value.wallpaper)
    expect(storedSettings().wallpaper).toBe(frameA.settings.value.wallpaper)
    expect(Object.keys(store.get('localWallpapers') as object)).toHaveLength(2)
    expect(frameB.wallpaper.resolve(frameB.settings.value.searchPageWallpaper)).toBe(OTHER_IMAGE)
  })

  it('keeps the inline wallpapers when the migration cannot be saved', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    store.set('settings', JSON.stringify(legacySettings))
    quota.bytes = storageBytes()
    // 让迁移那次写入本身就放不下
    store.set('filler', 'x'.repeat(64))
    const { settings } = await openSettingsFrame()

    await settings.ready
    expect(settings.value.wallpaper).toBe(IMAGE)
    expect(settings.value.enableWallpaperMasking).toBe(false)
    expect(storedSettings()).toEqual(legacySettings)
    expect(store.has('localWallpapers')).toBe(false)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('retries with padding when Safari rejects the smaller settings', async () => {
    const first = `data:image/jpeg;base64,${'A'.repeat(4000)}`
    const second = `data:image/jpeg;base64,${'B'.repeat(4000)}`
    // 文件名里的汉字让整个设置按双倍计，迁移后设置大幅变小，Safari算出负数
    store.set('settings', JSON.stringify({ ...legacySettings, wallpaper: first, searchPageWallpaper: second, locallyUploadedWallpaper: { name: '壁纸.jpg', url: second } }))
    quota.safari = true
    quota.bytes = 10 * 1024 * 1024
    const { settings } = await openSettingsFrame()

    await settings.ready
    await flush()
    expect(setCalls.filter(keys => keys.includes('settings')))
      .toEqual([['localWallpapers', 'settings'], ['localWallpapers', 'settings', 'settingsQuotaPadding']])
    expect(settings.value.wallpaper).toMatch(/^bewly-local-wallpaper:/)
    expect(storedSettings().wallpaper).toBe(settings.value.wallpaper)
    expect(storedSettings().locallyUploadedWallpaper.name).toBe('壁纸.jpg')
    expect(Object.values(store.get('localWallpapers') as object).sort()).toEqual([first, second])
    expect(store.has('settingsQuotaPadding')).toBe(false)
  })

  it('removes padding left behind by an interrupted migration', async () => {
    store.set('settings', JSON.stringify({ wallpaper: 'https://example.com/a.jpg' }))
    store.set('settingsQuotaPadding', 'A'.repeat(4000))
    const { settings } = await openSettingsFrame()

    await settings.ready
    await flush()
    expect(settings.value.wallpaper).toBe('https://example.com/a.jpg')
    expect(store.has('settingsQuotaPadding')).toBe(false)
  })

  it('does nothing when no wallpaper is inline', async () => {
    store.set('settings', JSON.stringify({ wallpaper: 'https://example.com/a.jpg' }))
    const { settings } = await openSettingsFrame()

    await settings.ready
    await flush()
    expect(settings.value.wallpaper).toBe('https://example.com/a.jpg')
    expect(readKeys).not.toContain('localWallpapers')
    expect(store.has('localWallpapers')).toBe(false)
  })
})
