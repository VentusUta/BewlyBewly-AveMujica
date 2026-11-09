import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, h, nextTick, ref } from 'vue'

import ToastRegion from '../components/ToastRegion.vue'
import { TOAST_TIMEOUT, toasts, useToast } from '../composables/useToast'
import { testI18n } from './helpers/i18n'
import { hidePopover, showPopover, useNativeDialogStubs } from './helpers/nativeDialog'

const apps: App[] = []

/** 等渲染和`TransitionGroup`的离场（jsdom里没有过渡，Vue在下一帧移除元素） */
async function settle() {
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

/** 挂一个常驻的根区和一个可开关的区，模拟"页面＋模态对话框" */
function mountRegions() {
  const nestedActive = ref(false)
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({
    render: () => [
      h('div', { id: 'root' }, h(ToastRegion)),
      h('div', { id: 'nested' }, h(ToastRegion, { active: nestedActive.value })),
    ],
  })
  app.use(testI18n)
  app.mount(container)
  apps.push(app)

  const read = (id: string) => {
    const scope = container.querySelector(`#${id}`)!
    return {
      popover: scope.querySelector('section')!,
      items: [...scope.querySelectorAll('li')].map(li => li.textContent!.trim()),
      status: scope.querySelector('[role="status"]')!.textContent,
      alert: scope.querySelector('[role="alert"]')!.textContent,
    }
  }
  return { nestedActive, root: () => read('root'), nested: () => read('nested') }
}

useNativeDialogStubs()

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  toasts.splice(0)
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('toast', () => {
  it('renders in the top region only and announces items new to that region', async () => {
    const { nestedActive, root, nested } = mountRegions()
    const toast = useToast()

    toast.info('first')
    await nextTick()
    expect(root().items).toEqual(['first'])
    expect(root().status).toBe('first')
    expect(showPopover.mock.contexts).toEqual([root().popover])

    nestedActive.value = true
    await settle()
    expect(root().items).toEqual([])
    expect(nested().items).toEqual(['first'])
    expect(nested().status).toBe('')
    expect(hidePopover.mock.contexts).toEqual([root().popover])
    expect(showPopover.mock.contexts.at(-1)).toBe(nested().popover)

    toast.error('second')
    await nextTick()
    expect(nested().items).toEqual(['second', 'first'])
    expect(nested().alert).toBe('second')
    expect(nested().status).toBe('')

    nestedActive.value = false
    await settle()
    expect(root().items).toEqual(['second', 'first'])
    expect(nested().items).toEqual([])
  })

  it('dismisses items after the timeout, pausing while hovered', async () => {
    vi.useFakeTimers()
    const { root } = mountRegions()
    const toast = useToast()

    toast.success('timed')
    await nextTick()
    expect(root().popover.querySelector('button')).toBeNull()
    root().popover.dispatchEvent(new Event('pointerenter'))
    vi.advanceTimersByTime(TOAST_TIMEOUT * 2)
    expect(toasts).toHaveLength(1)

    root().popover.dispatchEvent(new Event('pointerleave'))
    vi.advanceTimersByTime(TOAST_TIMEOUT - 1)
    expect(toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts).toHaveLength(0)
    await nextTick()
    expect(hidePopover.mock.contexts.at(-1)).toBe(root().popover)
  })
})
