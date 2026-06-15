import type { MaybeRef, RemovableRef } from '@vueuse/core'
import { StorageSerializers } from '@vueuse/core'
import type { Ref } from 'vue'
import { ref, toValue, watch } from 'vue'
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

  async function read() {
    try {
      const rawValue = (await storage.local.get(key))[key] as string | undefined

      if (rawValue == null) {
        data.value = rawInit
        if (writeDefaults && rawInit != null)
          await storage.local.set({ [key]: serializer.write(rawInit) })
      }
      else {
        const value = await serializer.read(rawValue)
        if (mergeDefaults && type === 'object' && value && !Array.isArray(value))
          data.value = { ...(rawInit as object), ...(value as object) } as T
        else
          data.value = value as T
      }
    }
    catch (e) {
      console.error(e)
    }
  }

  read().finally(() => {
    watch(
      data,
      async (value) => {
        try {
          if (value == null)
            await storage.local.remove(key)
          else
            await storage.local.set({ [key]: serializer.write(value) })
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
