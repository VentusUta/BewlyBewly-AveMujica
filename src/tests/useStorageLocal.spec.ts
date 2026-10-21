import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useStorageLocal } from '../composables/useStorageLocal'

const store = new Map<string, string>()
let failReads = false

vi.mock('webextension-polyfill', () => {
  const listeners: Array<(changes: any, area: string) => void> = []
  const browser = {
    runtime: { id: 'test-extension-id' },
    storage: {
      local: {
        get: async (key: string) => {
          if (failReads)
            throw new Error('read failed')
          return { [key]: store.get(key) }
        },
        set: async (items: Record<string, string>) => {
          for (const [k, v] of Object.entries(items))
            store.set(k, v)
        },
        remove: async (key: string) => { store.delete(key) },
      },
      onChanged: { addListener: (fn: any) => listeners.push(fn) },
    },
  }
  return { default: browser, storage: browser.storage }
})

describe('useStorageLocal persistence', () => {
  beforeEach(() => {
    store.clear()
    failReads = false
  })

  it('persists changes made after init', async () => {
    const data = useStorageLocal('test-key', { foo: 'bar' })
    await new Promise(r => setTimeout(r, 0))

    data.value.foo = 'baz'
    await new Promise(r => setTimeout(r, 0))

    expect(store.get('test-key')).toBe(JSON.stringify({ foo: 'baz' }))
  })

  it('keeps persisting many consecutive changes', async () => {
    const data = useStorageLocal('test-key-2', 'init')
    await new Promise(r => setTimeout(r, 0))

    for (let i = 0; i < 3; i++) {
      data.value = `value-${i}`
      await new Promise(r => setTimeout(r, 0))
      expect(store.get('test-key-2')).toBe(`value-${i}`)
    }
  })
})

describe('useStorageLocal ready', () => {
  beforeEach(() => {
    store.clear()
    failReads = false
  })

  it('resolves after the stored value is applied', async () => {
    store.set('ready-key', JSON.stringify({ mode: 'app' }))
    const data = useStorageLocal('ready-key', { mode: 'web' })
    expect(data.value.mode).toBe('web')

    await data.ready
    expect(data.value.mode).toBe('app')

    data.value.mode = 'web'
    await new Promise(r => setTimeout(r, 0))
    expect(store.get('ready-key')).toBe(JSON.stringify({ mode: 'web' }))
  })

  it('resolves with the default value when nothing is stored', async () => {
    const data = useStorageLocal('ready-key-2', { mode: 'web' })

    await data.ready
    expect(data.value.mode).toBe('web')
    expect(store.get('ready-key-2')).toBe(JSON.stringify({ mode: 'web' }))
  })

  it('resolves even when the read fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    failReads = true
    const data = useStorageLocal('ready-key-3', { mode: 'web' })

    await expect(data.ready).resolves.toBeUndefined()
    expect(data.value.mode).toBe('web')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
