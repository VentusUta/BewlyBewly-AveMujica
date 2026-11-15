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

const regions = shallowReactive<symbol[]>([])

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
