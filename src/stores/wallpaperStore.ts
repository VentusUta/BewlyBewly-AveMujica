import md5 from 'md5'
import { defineStore } from 'pinia'
import type { Storage } from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import { isExtensionContextValid } from '~/utils/extensionContext'

const STORAGE_KEY = 'localWallpapers'
const REF_PREFIX = 'bewly-local-wallpaper:'

type LocalWallpapers = Record<string, string>

function getLocalWallpaperId(wallpaper: string): string | undefined {
  return wallpaper.startsWith(REF_PREFIX) ? wallpaper.slice(REF_PREFIX.length) : undefined
}

function hashWallpaper(dataUrl: string): string {
  return md5(dataUrl).slice(0, 16)
}

export function isLocalWallpaper(wallpaper: string): boolean {
  return wallpaper.startsWith('data:image/') || wallpaper.startsWith(REF_PREFIX)
}

export const useWallpaperStore = defineStore('wallpaper', () => {
  const images = shallowRef<LocalWallpapers>({})
  let loading: Promise<void> | undefined

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
    const nextIds = Object.keys(next)
    if (Object.keys(current).length === nextIds.length && nextIds.every(id => id in current))
      return

    if (nextIds.length)
      await browser.storage.local.set({ [STORAGE_KEY]: next })
    else
      await browser.storage.local.remove(STORAGE_KEY)
    images.value = next
  }

  async function save(dataUrl: string): Promise<string> {
    const id = hashWallpaper(dataUrl)
    await update(wallpapers => ({ ...wallpapers, [id]: dataUrl }))
    return REF_PREFIX + id
  }

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

  async function prune(used: string[]) {
    const usedIds = new Set(used.map(getLocalWallpaperId))
    await update(wallpapers => Object.fromEntries(Object.entries(wallpapers).filter(([id]) => usedIds.has(id))))
  }

  return { images, load, resolve, save, stage, prune }
})
