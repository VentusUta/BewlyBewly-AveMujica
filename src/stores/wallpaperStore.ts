import md5 from 'md5'
import { defineStore } from 'pinia'
import type { Storage } from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import { isExtensionContextValid } from '~/utils/extensionContext'

// 本地上传的壁纸以内容哈希为键存放在单独的存储项里，`settings`中只保存对它的引用
const STORAGE_KEY = 'localWallpapers'
const REF_PREFIX = 'bewly-local-wallpaper:'

type LocalWallpapers = Record<string, string>

function getLocalWallpaperId(wallpaper: string): string | undefined {
  return wallpaper.startsWith(REF_PREFIX) ? wallpaper.slice(REF_PREFIX.length) : undefined
}

// 不要换成`crypto.subtle`：Firefox的内容脚本里它返回的promise无法等待
function hashWallpaper(dataUrl: string): string {
  return md5(dataUrl).slice(0, 16)
}

// 上传的壁纸有两种形态：已存入的引用，和旧版本内联的data URL
export function isLocalWallpaper(wallpaper: string): boolean {
  return wallpaper.startsWith('data:image/') || wallpaper.startsWith(REF_PREFIX)
}

export const useWallpaperStore = defineStore('wallpaper', () => {
  const images = shallowRef<LocalWallpapers>({})
  let loading: Promise<void> | undefined

  // 首次遇到引用时才读取，没有上传壁纸的frame不必读这个存储项
  function load(): Promise<void> {
    loading ??= (async () => {
      let changedWhileLoading = false
      try {
        browser.storage.onChanged.addListener((changes: Record<string, Storage.StorageChange>, areaName: string) => {
          if (areaName !== 'local' || !(STORAGE_KEY in changes))
            return
          changedWhileLoading = true
          images.value = (changes[STORAGE_KEY].newValue as LocalWallpapers | undefined) ?? {}
        })
        const stored = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as LocalWallpapers | undefined
        if (!changedWhileLoading)
          images.value = stored ?? {}
      }
      catch (e) {
        if (isExtensionContextValid())
          console.error(e)
      }
    })()
    return loading
  }

  // 引用指向的图片读回之前返回空字符串，找不到图片时也是
  function resolve(wallpaper: string): string {
    const id = getLocalWallpaperId(wallpaper)
    if (id === undefined)
      return wallpaper
    load()
    return images.value[id] ?? ''
  }

  async function update(change: (wallpapers: LocalWallpapers) => LocalWallpapers) {
    await load()
    const current = images.value
    const next = change(current)
    // 以内容哈希为键，键相同内容就相同
    const nextIds = Object.keys(next)
    if (Object.keys(current).length === nextIds.length && nextIds.every(id => id in current))
      return

    if (nextIds.length)
      await browser.storage.local.set({ [STORAGE_KEY]: next })
    else
      await browser.storage.local.remove(STORAGE_KEY)
    images.value = next
  }

  // 返回应写进设置的引用。要等它完成再写设置，否则其他frame会先拿到指向空的引用
  async function save(dataUrl: string): Promise<string> {
    const id = hashWallpaper(dataUrl)
    await update(wallpapers => ({ ...wallpapers, [id]: dataUrl }))
    return REF_PREFIX + id
  }

  // 只算出引用和要写入的存储项，不写入，也不更新`images`。供迁移把图片和设置放进同一次`set`
  async function stage(dataUrls: string[]) {
    await load()
    const next = { ...images.value }
    const refs = new Map<string, string>()
    for (const dataUrl of dataUrls) {
      const id = hashWallpaper(dataUrl)
      next[id] = dataUrl
      refs.set(dataUrl, REF_PREFIX + id)
    }
    return { refs, items: { [STORAGE_KEY]: next } }
  }

  // 不在`used`里的图片都会被删除，要把设置中所有壁纸字段的值传全
  async function prune(used: string[]) {
    const usedIds = new Set(used.map(getLocalWallpaperId))
    await update(wallpapers => Object.fromEntries(Object.entries(wallpapers).filter(([id]) => usedIds.has(id))))
  }

  return { images, load, resolve, save, stage, prune }
})
