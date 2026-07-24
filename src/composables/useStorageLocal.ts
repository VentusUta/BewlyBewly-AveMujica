import type { MaybeRef, RemovableRef } from '@vueuse/core'
import { StorageSerializers } from '@vueuse/core'
import type { Ref } from 'vue'
import { nextTick, ref, toValue, watch } from 'vue'
import type { Storage } from 'webextension-polyfill'
import { storage } from 'webextension-polyfill'

interface UseStorageLocalOptions {
  /** Merge the stored value with the default value (shallow) instead of replacing it. */
  mergeDefaults?: boolean
  /** Persist the default value when nothing is stored yet. Defaults to `true`. */
  writeDefaults?: boolean
  /** Deep watch the value for changes. Defaults to `true`. */
  deep?: boolean
}

type SerializerType = keyof typeof StorageSerializers

function guessSerializerType<T>(rawInit: T): SerializerType {
  return rawInit == null
    ? 'any'
    : rawInit instanceof Set
      ? 'set'
      : rawInit instanceof Map
        ? 'map'
        : rawInit instanceof Date
          ? 'date'
          : typeof rawInit === 'boolean'
            ? 'boolean'
            : typeof rawInit === 'string'
              ? 'string'
              : typeof rawInit === 'object'
                ? 'object'
                : !Number.isNaN(rawInit as number)
                    ? 'number'
                    : 'any'
}

/**
 * A `storage.local`-backed ref.
 */
export function useStorageLocal<T>(
  key: string,
  initialValue: MaybeRef<T>,
  options: UseStorageLocalOptions = {},
): RemovableRef<T> {
  const { mergeDefaults = false, writeDefaults = true, deep = true } = options

  const rawInit = toValue(initialValue) as T
  const type = guessSerializerType(rawInit)
  const serializer = StorageSerializers[type]
  const data = ref(rawInit) as Ref<T>

  let applyingExternalChange = false
  let lastRawValue: string | undefined

  function mergeIfNeeded(value: T): T {
    if (mergeDefaults && type === 'object' && value && !Array.isArray(value))
      return { ...(rawInit as object), ...(value as object) } as T
    return value
  }

  function applyValue(value: T, rawValue: string | undefined) {
    applyingExternalChange = true
    data.value = value
    lastRawValue = rawValue
    nextTick(() => {
      applyingExternalChange = false
    })
  }

  async function read() {
    try {
      const rawValue = (await storage.local.get(key))[key] as string | undefined

      if (rawValue == null) {
        applyValue(rawInit, undefined)
        if (writeDefaults && rawInit != null) {
          const written = serializer.write(rawInit)
          lastRawValue = written
          await storage.local.set({ [key]: written })
        }
      }
      else {
        const value = mergeIfNeeded(await serializer.read(rawValue) as T)
        applyValue(value, rawValue)
      }
    }
    catch (e) {
      console.error(e)
    }
  }

  function onStorageChanged(
    changes: Record<string, Storage.StorageChange>,
    areaName: string,
  ) {
    if (areaName !== 'local' || !(key in changes))
      return

    const newRaw = changes[key].newValue as string | undefined

    if (newRaw === lastRawValue)
      return

    if (newRaw == null) {
      applyValue(rawInit, undefined)
      return
    }

    Promise.resolve(serializer.read(newRaw)).then((value) => {
      if (newRaw === lastRawValue)
        return

      applyValue(mergeIfNeeded(value as T), newRaw)
    }).catch(console.error)
  }

  storage.onChanged.addListener(onStorageChanged)

  read().finally(() => {
    watch(
      data,
      async (value) => {
        if (applyingExternalChange)
          return

        try {
          if (value == null) {
            lastRawValue = undefined
            await storage.local.remove(key)
          }
          else {
            const written = serializer.write(value)
            lastRawValue = written
            await storage.local.set({ [key]: written })
          }
        }
        catch (e) {
          console.error(e)
        }
      },
      { deep, flush: 'pre' },
    )
  })

  return data as RemovableRef<T>
}
