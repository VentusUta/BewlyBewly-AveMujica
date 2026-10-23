import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'

import type { InfiniteListOptions, InfiniteLoadResult } from '../composables/useInfiniteList'
import { useInfiniteList } from '../composables/useInfiniteList'

// 模拟 IntersectionObserver：新的观察立即回调一次，intersecting 表示哨兵当前是否在扩展区内
let intersecting = true
const observers = new Set<MockIntersectionObserver>()

class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {
    observers.add(this)
  }

  observe() {
    queueMicrotask(() => {
      if (observers.has(this))
        this.notify()
    })
  }

  notify() {
    this.callback([{ isIntersecting: intersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }

  unobserve() {}
  disconnect() {
    observers.delete(this)
  }

  takeRecords() {
    return []
  }
}

async function settle() {
  for (let i = 0; i < 20; i++)
    await new Promise(resolve => setTimeout(resolve, 0))
}

function mountList(options: Omit<InfiniteListOptions, 'sentinel'>) {
  let list!: ReturnType<typeof useInfiniteList>
  const app = createApp(defineComponent({
    setup() {
      const sentinel = ref<HTMLElement>()
      list = useInfiniteList({ sentinel, ...options })
      return () => h('div', [h('div', { ref: sentinel })])
    },
  }))
  app.mount(document.createElement('div'))
  return { list, unmount: () => app.unmount() }
}

describe('useInfiniteList', () => {
  beforeEach(() => {
    intersecting = true
    observers.clear()
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(callback, 0))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps loading while the sentinel stays in range', async () => {
    let calls = 0
    mountList({
      load: async () => {
        calls++
        if (calls === 3)
          intersecting = false
        return 'more'
      },
    })
    await settle()
    expect(calls).toBe(3)
  })

  it('stops observing after load returns done', async () => {
    const load = vi.fn(async (): Promise<InfiniteLoadResult> => 'done')
    const { list } = mountList({ load })
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(list.done.value).toBe(true)
    expect(observers.size).toBe(0)
  })

  it('pauses after consecutive empty loads and resumes on scroll', async () => {
    const load = vi.fn(async (): Promise<InfiniteLoadResult> => 'empty')
    mountList({ load, maxEmptyLoads: 3 })
    await settle()
    expect(load).toHaveBeenCalledTimes(3)

    window.dispatchEvent(new Event('scroll'))
    await settle()
    expect(load).toHaveBeenCalledTimes(6)
  })

  it('pauses after a failed load until the user scrolls', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    const { list } = mountList({
      load: async () => {
        calls++
        if (calls === 1)
          throw new Error('network')
        intersecting = false
        return 'more'
      },
    })
    await settle()
    expect(calls).toBe(1)
    expect(list.error.value).toBeInstanceOf(Error)

    window.dispatchEvent(new Event('scroll'))
    await settle()
    expect(calls).toBe(2)
    expect(list.error.value).toBeUndefined()
  })

  it('aborts the pending load on restart and starts over', async () => {
    const signals: AbortSignal[] = []
    let finish!: () => void
    const { list } = mountList({
      load: (signal) => {
        signals.push(signal)
        if (signals.length === 1)
          return new Promise(resolve => finish = () => resolve('more'))
        return Promise.resolve('done')
      },
    })
    await settle()
    expect(list.loading.value).toBe(true)

    await list.restart()
    await settle()
    expect(signals[0].aborted).toBe(true)
    expect(signals).toHaveLength(2)
    expect(list.done.value).toBe(true)

    finish()
    await settle()
    expect(signals).toHaveLength(2)
    expect(list.done.value).toBe(true)
  })

  it('waits for canLoadMore before loading', async () => {
    let ready = false
    const load = vi.fn(async (): Promise<InfiniteLoadResult> => 'done')
    const { list } = mountList({ load, canLoadMore: () => ready })
    await settle()
    expect(load).not.toHaveBeenCalled()

    ready = true
    await list.restart()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('aborts the pending load and disconnects on unmount', async () => {
    let signal: AbortSignal | undefined
    const { unmount } = mountList({
      load: (s) => {
        signal = s
        return new Promise(() => {})
      },
    })
    await settle()
    unmount()
    expect(signal?.aborted).toBe(true)
    expect(observers.size).toBe(0)
  })
})
