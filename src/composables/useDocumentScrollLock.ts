import type { MaybeRefOrGetter } from 'vue'

export const SCROLL_LOCK_ATTRIBUTE = 'data-bewly-scroll-lock'
const SCROLL_GUTTER_ATTRIBUTE = 'data-bewly-scroll-gutter'

let lockCount = 0
let lockedElements: HTMLElement[] = []

function isOverflowVisible(el: Element): boolean {
  const { overflowX, overflowY } = getComputedStyle(el)
  return overflowX === 'visible' && overflowY === 'visible'
}

function hasClassicScrollbar(el: HTMLElement): boolean {
  if (el === document.documentElement)
    return window.innerWidth - el.clientWidth > 0
  const { borderLeftWidth, borderRightWidth } = getComputedStyle(el)
  return el.offsetWidth - el.clientWidth - Number.parseFloat(borderLeftWidth) - Number.parseFloat(borderRightWidth) > 0
}

// 视口沿用 html 的 overflow，html 为 visible 时改用 body 的；body 自己也可能是滚动容器
function getScrollingRoots(): HTMLElement[] {
  const root = document.documentElement
  const body = document.body
  if (!body || isOverflowVisible(body))
    return [root]
  return isOverflowVisible(root) ? [body] : [root, body]
}

export function lockDocumentScroll(): () => void {
  if (lockCount++ === 0) {
    const root = document.documentElement
    lockedElements = getScrollingRoots()
    root.toggleAttribute(SCROLL_GUTTER_ATTRIBUTE, hasClassicScrollbar(root))
    for (const el of lockedElements) {
      if (el !== root)
        el.toggleAttribute(SCROLL_GUTTER_ATTRIBUTE, hasClassicScrollbar(el))
      el.setAttribute(SCROLL_LOCK_ATTRIBUTE, '')
    }
  }

  let released = false
  return () => {
    if (released)
      return
    released = true
    if (--lockCount === 0) {
      for (const el of [document.documentElement, ...lockedElements]) {
        el.removeAttribute(SCROLL_LOCK_ATTRIBUTE)
        el.removeAttribute(SCROLL_GUTTER_ATTRIBUTE)
      }
      lockedElements = []
    }
  }
}

export function useDocumentScrollLock(enabled: MaybeRefOrGetter<boolean> = true) {
  let active = false
  let release: (() => void) | undefined

  function sync() {
    const shouldLock = active && toValue(enabled)
    if (shouldLock && !release) {
      release = lockDocumentScroll()
    }
    else if (!shouldLock && release) {
      release()
      release = undefined
    }
  }

  watch(() => toValue(enabled), sync)
  onMounted(() => {
    active = true
    sync()
  })
  onActivated(() => {
    active = true
    sync()
  })
  onDeactivated(() => {
    active = false
    sync()
  })
  onBeforeUnmount(() => {
    active = false
    sync()
  })
}
