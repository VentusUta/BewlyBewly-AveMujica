import { useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'

const SCROLLABLE_OVERFLOW = /auto|scroll|overlay/

function canScrollToward(el: Element, deltaX: number, deltaY: number): boolean {
  const style = getComputedStyle(el)
  if (deltaY !== 0 && SCROLLABLE_OVERFLOW.test(style.overflowY)) {
    const max = el.scrollHeight - el.clientHeight
    if (max > 0 && (deltaY > 0 ? el.scrollTop < max - 1 : el.scrollTop > 0))
      return true
  }
  if (deltaX !== 0 && SCROLLABLE_OVERFLOW.test(style.overflowX)) {
    const max = el.scrollWidth - el.clientWidth
    if (max > 0 && (deltaX > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 0))
      return true
  }
  return false
}

export function useWheelContain(target: MaybeRefOrGetter<EventTarget | null | undefined>, rootSelector: string) {
  useEventListener(target, 'wheel', (e: WheelEvent) => {
    if (e.ctrlKey)
      return

    const path = e.composedPath()
    const rootIndex = path.findIndex(node => node instanceof Element && node.matches(rootSelector))
    if (rootIndex < 0)
      return

    for (const node of path.slice(0, rootIndex + 1)) {
      if (node instanceof Element && canScrollToward(node, e.deltaX, e.deltaY))
        return
    }
    e.preventDefault()
  }, { passive: false })
}
