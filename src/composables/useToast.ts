import type { MaybeRefOrGetter } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

export const TOAST_TIMEOUT = 5000
const MAX_TOASTS = 20

interface ToastTimer {
  handle?: ReturnType<typeof setTimeout>
  remaining: number
  startedAt: number
}

let nextId = 0
let paused = false
const timers = new Map<number, ToastTimer>()

/** 当前所有轻提示，最新的在前 */
export const toasts = shallowReactive<ToastItem[]>([])

function startTimer(id: number, timer: ToastTimer) {
  timer.startedAt = Date.now()
  timer.handle = setTimeout(dismiss, timer.remaining, id)
}

function dismiss(id: number) {
  const timer = timers.get(id)
  if (timer)
    clearTimeout(timer.handle)
  timers.delete(id)

  const index = toasts.findIndex(item => item.id === id)
  if (index !== -1)
    toasts.splice(index, 1)
}

/** 指针停在轻提示区上时，所有轻提示的倒计时一起暂停 */
export function pauseToasts() {
  paused = true
  for (const timer of timers.values()) {
    clearTimeout(timer.handle)
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
  }
}

export function resumeToasts() {
  paused = false
  for (const [id, timer] of timers)
    startTimer(id, timer)
}

function push(type: ToastType, message: string) {
  const id = ++nextId
  toasts.unshift({ id, type, message })
  for (const extra of toasts.slice(MAX_TOASTS))
    dismiss(extra.id)

  const timer: ToastTimer = { remaining: TOAST_TIMEOUT, startedAt: Date.now() }
  timers.set(id, timer)
  if (!paused)
    startTimer(id, timer)
}

const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  warning: (message: string) => push('warning', message),
  info: (message: string) => push('info', message),
}

export function useToast() {
  return toast
}

/** 轻提示区栈，最后一个是栈顶；轻提示只渲染进栈顶的区 */
const regions = shallowReactive<symbol[]>([])

/**
 * 把当前组件登记为一个轻提示区。`active`为真时压栈，为假或卸载时出栈。
 * 模态对话框里的区必须随对话框开关：它被`display: none`的祖先包着时即使弹出也画不出来。
 */
export function useToastRegion(active: MaybeRefOrGetter<boolean>) {
  const id = Symbol('toast region')

  function remove() {
    const index = regions.indexOf(id)
    if (index !== -1)
      regions.splice(index, 1)
  }

  watch(() => toValue(active), (isActive) => {
    remove()
    if (isActive)
      regions.push(id)
  }, { immediate: true })
  onBeforeUnmount(remove)

  return {
    isTop: computed(() => regions.at(-1) === id),
  }
}
