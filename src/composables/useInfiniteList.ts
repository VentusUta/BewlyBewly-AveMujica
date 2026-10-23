import type { MaybeRefOrGetter, Ref } from 'vue'

/**
 * 一次加载的结果：
 * - `more`：加载到了新内容
 * - `empty`：请求成功，但没有可显示的新内容（例如全被筛掉）
 * - `done`：没有更多内容了
 */
export type InfiniteLoadResult = 'more' | 'empty' | 'done'

export interface InfiniteListOptions {
  /** 放在列表末尾的哨兵元素 */
  sentinel: Readonly<Ref<HTMLElement | null | undefined>>
  /** 列表所在的滚动容器，缺省为视口 */
  root?: MaybeRefOrGetter<HTMLElement | null | undefined>
  /** 哨兵进入这个范围就开始加载，缺省为视口下方 300px */
  rootMargin?: string
  /** 返回 false 时不加载，例如还没登录；条件变为 true 后需调用 `restart()` */
  canLoadMore?: () => boolean
  /** 加载下一页。抛出错误时暂停，等用户滚动后再试 */
  load: (signal: AbortSignal) => Promise<InfiniteLoadResult>
  /** 连续多少次加载没有新内容后暂停，等用户滚动后再继续 */
  maxEmptyLoads?: number
}

/**
 * 由列表末尾的哨兵驱动无限加载：哨兵进入视口下方的扩展区就加载下一页，
 * 加载完后重新观察，哨兵仍在扩展区内就接着加载，所以首屏撑不满时会自动补齐。
 * 组件停用或卸载时断开观察并中止正在进行的加载。
 */
export function useInfiniteList(options: InfiniteListOptions) {
  const {
    sentinel,
    root,
    rootMargin = '0px 0px 300px 0px',
    canLoadMore = () => true,
    load,
    maxEmptyLoads = 3,
  } = options

  const loading = shallowRef<boolean>(false)
  const done = shallowRef<boolean>(false)
  /** 最近一次加载抛出的错误，下次加载成功或重新开始时清除 */
  const error = shallowRef<unknown>()

  let active = false
  let observer: IntersectionObserver | undefined
  let controller: AbortController | undefined
  let emptyLoads = 0
  let removeResumeListener: (() => void) | undefined

  function getScrollTarget(): HTMLElement | Window {
    return toValue(root) ?? window
  }

  function disconnect() {
    observer?.disconnect()
    observer = undefined
  }

  // 每次都新建观察，按规范新的观察必定立即回调一次，据此判断哨兵是否仍在扩展区内
  function observe() {
    disconnect()
    const el = sentinel.value
    if (!active || done.value || removeResumeListener || !el)
      return

    observer = new IntersectionObserver((entries) => {
      if (entries.at(-1)?.isIntersecting)
        loadMore()
    }, { root: toValue(root) ?? null, rootMargin })
    observer.observe(el)
  }

  // 暂停后等用户滚动再继续，以免请求出错或内容一直为空时不停地请求
  function pause() {
    disconnect()
    const target = getScrollTarget()
    const resume = () => {
      removeResumeListener?.()
      emptyLoads = 0
      observe()
    }
    target.addEventListener('scroll', resume, { passive: true })
    removeResumeListener = () => {
      target.removeEventListener('scroll', resume)
      removeResumeListener = undefined
    }
  }

  async function loadMore() {
    if (loading.value || done.value || !canLoadMore())
      return

    const currentController = new AbortController()
    controller = currentController
    loading.value = true

    let result: InfiniteLoadResult | undefined
    try {
      result = await load(currentController.signal)
      if (!currentController.signal.aborted)
        error.value = undefined
    }
    catch (e) {
      if (!currentController.signal.aborted) {
        error.value = e
        console.error('[BewlyBewly] Failed to load more content:', e)
      }
    }
    finally {
      if (controller === currentController) {
        controller = undefined
        loading.value = false
      }
    }

    if (currentController.signal.aborted)
      return
    if (!result) {
      pause()
      return
    }
    if (result === 'done') {
      done.value = true
      disconnect()
      return
    }

    emptyLoads = result === 'empty' ? emptyLoads + 1 : 0
    if (emptyLoads >= maxEmptyLoads) {
      pause()
      return
    }

    // 等新内容渲染出来，再重新观察
    await nextTick()
    await new Promise(resolve => requestAnimationFrame(resolve))
    if (!currentController.signal.aborted && controller === undefined)
      observe()
  }

  function abort() {
    controller?.abort()
    controller = undefined
    loading.value = false
  }

  /** 页面清空列表后调用：中止正在进行的加载，从头开始观察 */
  async function restart() {
    abort()
    removeResumeListener?.()
    done.value = false
    error.value = undefined
    emptyLoads = 0
    await nextTick()
    observe()
  }

  function start() {
    if (active)
      return
    active = true
    observe()
  }

  function stop() {
    active = false
    disconnect()
    removeResumeListener?.()
    abort()
  }

  onMounted(start)
  onActivated(start)
  onDeactivated(stop)
  onBeforeUnmount(stop)

  // 哨兵随 v-if 出现、消失或被替换时重新观察
  watch(sentinel, () => observe(), { flush: 'post' })

  return {
    loading: readonly(loading),
    done: readonly(done),
    error: readonly(error),
    restart,
  }
}
