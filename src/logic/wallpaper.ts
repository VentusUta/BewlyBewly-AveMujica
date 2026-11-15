import { getActivePinia } from 'pinia'

import { useWallpaperStore } from '~/stores/wallpaperStore'
import { isExtensionContextValid } from '~/utils/extensionContext'

import type { Settings } from './storage'

type WallpaperSettings = Pick<Settings, 'wallpaper' | 'searchPageWallpaper' | 'locallyUploadedWallpaper'>

function getWallpaperFields(settings: WallpaperSettings): string[] {
  return [settings.wallpaper, settings.searchPageWallpaper, settings.locallyUploadedWallpaper?.url]
    .filter((wallpaper): wallpaper is string => typeof wallpaper === 'string')
}

function mapWallpaperFields<T extends WallpaperSettings>(settings: T, map: (wallpaper: string) => string): T {
  const result = { ...settings }
  if (typeof settings.wallpaper === 'string')
    result.wallpaper = map(settings.wallpaper)
  if (typeof settings.searchPageWallpaper === 'string')
    result.searchPageWallpaper = map(settings.searchPageWallpaper)
  if (typeof settings.locallyUploadedWallpaper?.url === 'string')
    result.locallyUploadedWallpaper = { ...settings.locallyUploadedWallpaper, url: map(settings.locallyUploadedWallpaper.url) }
  return result
}

function getInlineWallpapers(settings: WallpaperSettings): string[] {
  return [...new Set(getWallpaperFields(settings))].filter(wallpaper => wallpaper.startsWith('data:image/'))
}

export async function migrateInlineWallpapers<T extends WallpaperSettings>(settings: T) {
  const inline = getInlineWallpapers(settings)
  if (!inline.length || !getActivePinia())
    return undefined
  const { refs, items } = await useWallpaperStore().stage(inline)
  return { value: mapWallpaperFields(settings, value => refs.get(value) ?? value), items }
}

export async function storeInlineWallpapers<T extends WallpaperSettings>(settings: T): Promise<T> {
  const wallpaper = useWallpaperStore()
  const refs = new Map<string, string>()
  for (const dataUrl of getInlineWallpapers(settings))
    refs.set(dataUrl, await wallpaper.save(dataUrl))
  return refs.size ? mapWallpaperFields(settings, value => refs.get(value) ?? value) : settings
}

export async function inlineLocalWallpapers<T extends WallpaperSettings>(settings: T): Promise<T> {
  const wallpaper = useWallpaperStore()
  await wallpaper.load()
  return mapWallpaperFields(settings, wallpaper.resolve)
}

export async function pruneLocalWallpapers(settings: WallpaperSettings) {
  await nextTick()
  try {
    await useWallpaperStore().prune(getWallpaperFields(settings))
  }
  catch (e) {
    if (isExtensionContextValid())
      console.error(e)
  }
}
