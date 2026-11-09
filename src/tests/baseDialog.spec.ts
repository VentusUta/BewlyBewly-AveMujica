import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, h, nextTick, ref } from 'vue'

import type { DialogClosedBy } from '../components/Dialog/BaseDialog.vue'
import BaseDialog from '../components/Dialog/BaseDialog.vue'
import { SCROLL_LOCK_ATTRIBUTE } from '../composables/useDocumentScrollLock'
import { testI18n } from './helpers/i18n'
import { close, FakeKeyframeEffect, requestClose, supportsOverlay, useNativeDialogStubs } from './helpers/nativeDialog'

const apps: App[] = []

function mountDialog(closedby?: DialogClosedBy) {
  const open = ref(true)
  const onClose = vi.fn()
  const onClosed = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({
    render: () => h(BaseDialog, {
      'open': open.value,
      closedby,
      'onUpdate:open': (value: boolean) => open.value = value,
      onClose,
      onClosed,
    }, () => h('p', 'Content')),
  })
  app.use(testI18n)
  app.mount(container)
  apps.push(app)
  return { open, onClose, onClosed, dialog: container.querySelector('dialog')! }
}

/** 给dialog挂上一段有限的退场动画和一段永不结束的动画，返回结束前者的函数 */
function stubExitAnimation(dialog: HTMLDialogElement) {
  let finish!: () => void
  const finished = new Promise<void>(resolve => finish = resolve)
  dialog.getAnimations = () => [
    { effect: new FakeKeyframeEffect(dialog, 500), finished },
    { effect: new FakeKeyframeEffect(dialog, Infinity), finished: new Promise(() => {}) },
  ] as unknown as Animation[]
  return finish
}

function pointer(dialog: HTMLDialogElement, type: 'pointerdown' | 'pointerup', at: number) {
  dialog.dispatchEvent(new MouseEvent(type, { clientX: at, clientY: at, bubbles: true }))
}

const flushPromises = () => new Promise(resolve => setTimeout(resolve))

useNativeDialogStubs()

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('baseDialog', () => {
  it('keeps v-model, the native state and the scroll lock in sync', async () => {
    const { open, dialog } = mountDialog()
    await nextTick()
    expect(dialog.open).toBe(true)
    expect(document.documentElement.hasAttribute(SCROLL_LOCK_ATTRIBUTE)).toBe(true)

    dialog.requestClose()
    await nextTick()
    expect(open.value).toBe(false)
    expect(document.documentElement.hasAttribute(SCROLL_LOCK_ATTRIBUTE)).toBe(false)

    open.value = true
    await nextTick()
    expect(dialog.open).toBe(true)
  })

  it('refuses close requests when closedby is none', async () => {
    const { open, dialog } = mountDialog('none')

    dialog.requestClose()
    await nextTick()
    expect(dialog.open).toBe(true)
    expect(open.value).toBe(true)
  })

  it('keeps key events from bubbling out to the page', async () => {
    const { dialog } = mountDialog()
    await nextTick()
    const types = ['keydown', 'keypress', 'keyup']
    const onPageKey = vi.fn()
    const onDialogKey = vi.fn()
    for (const type of types) {
      document.addEventListener(type, onPageKey)
      dialog.addEventListener(type, onDialogKey)
    }

    for (const type of types)
      dialog.querySelector('p')!.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', bubbles: true, composed: true }))
    expect(onDialogKey).toHaveBeenCalledTimes(3)
    expect(onPageKey).not.toHaveBeenCalled()

    for (const type of types)
      document.removeEventListener(type, onPageKey)
  })

  it('closes open descendants from the inside out before itself', async () => {
    const { open, dialog } = mountDialog()
    const child = document.createElement('dialog')
    child.open = true
    const popover = document.createElement('div')
    popover.setAttribute('popover', '')
    const hidePopover = vi.fn()
    popover.hidePopover = hidePopover
    child.append(popover)
    dialog.append(child)

    open.value = false
    await nextTick()
    expect(close.mock.contexts).toEqual([child, dialog])
    expect(hidePopover.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0])
  })

  it('emits closed after the finite exit animations, unless reopened first', async () => {
    const { open, dialog, onClose, onClosed } = mountDialog()

    let finish = stubExitAnimation(dialog)
    open.value = false
    await nextTick()
    await flushPromises()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClosed).not.toHaveBeenCalled()
    finish()
    await flushPromises()
    expect(onClosed).toHaveBeenCalledTimes(1)

    open.value = true
    await nextTick()
    finish = stubExitAnimation(dialog)
    open.value = false
    await nextTick()
    open.value = true
    await nextTick()
    finish()
    await flushPromises()
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('plays the exit before closing where a closed dialog cannot stay in the top layer', async () => {
    supportsOverlay.mockReturnValue(false)
    const { open, dialog, onClose, onClosed } = mountDialog()
    await nextTick()

    // 退场一开始就宣告关闭，原生的关闭留到退场播完
    const finish = stubExitAnimation(dialog)
    dialog.requestClose()
    await nextTick()
    await flushPromises()
    expect(dialog.open).toBe(true)
    expect(dialog.hasAttribute('data-closing')).toBe(true)
    expect(dialog.inert).toBe(true)
    expect(open.value).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.documentElement.hasAttribute(SCROLL_LOCK_ATTRIBUTE)).toBe(false)
    expect(onClosed).not.toHaveBeenCalled()

    finish()
    await flushPromises()
    expect(dialog.open).toBe(false)
    expect(dialog.hasAttribute('data-closing')).toBe(false)
    expect(dialog.inert).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('aborts that exit when reopened, and skips it when unmounted', async () => {
    supportsOverlay.mockReturnValue(false)
    const { open, dialog, onClosed } = mountDialog()
    await nextTick()

    const finish = stubExitAnimation(dialog)
    open.value = false
    await nextTick()
    expect(dialog.hasAttribute('data-closing')).toBe(true)
    open.value = true
    await nextTick()
    finish()
    await flushPromises()
    expect(dialog.open).toBe(true)
    expect(dialog.hasAttribute('data-closing')).toBe(false)
    expect(dialog.inert).toBe(false)
    expect(document.documentElement.hasAttribute(SCROLL_LOCK_ATTRIBUTE)).toBe(true)
    expect(onClosed).not.toHaveBeenCalled()

    stubExitAnimation(dialog)
    apps.splice(0)[0].unmount()
    expect(dialog.open).toBe(false)
  })

  it('falls back to light dismiss only without native closedby', () => {
    const { dialog } = mountDialog()
    dialog.getBoundingClientRect = () => ({ left: 100, right: 300, top: 100, bottom: 300 }) as DOMRect

    pointer(dialog, 'pointerdown', 150)
    pointer(dialog, 'pointerup', 50)
    expect(requestClose).not.toHaveBeenCalled()
    pointer(dialog, 'pointerdown', 50)
    pointer(dialog, 'pointerup', 50)
    expect(requestClose).toHaveBeenCalledTimes(1)

    const { dialog: nativeDialog } = mountDialog()
    Object.defineProperty(nativeDialog, 'closedBy', { value: 'any' })
    nativeDialog.getBoundingClientRect = dialog.getBoundingClientRect
    pointer(nativeDialog, 'pointerdown', 50)
    pointer(nativeDialog, 'pointerup', 50)
    expect(requestClose).toHaveBeenCalledTimes(1)
  })
})
