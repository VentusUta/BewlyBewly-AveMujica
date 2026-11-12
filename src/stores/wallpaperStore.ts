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

  return { images, resolve }
})
