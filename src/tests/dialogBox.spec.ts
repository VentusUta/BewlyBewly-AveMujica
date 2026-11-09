import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createApp, h, nextTick } from 'vue'

import DialogBox from '../components/Dialog/DialogBox.vue'
import { testI18n } from './helpers/i18n'
import { close, useNativeDialogStubs } from './helpers/nativeDialog'

const apps: App[] = []

function mountDialogBox(props: { onConfirm?: () => unknown } = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({
    render: () => h(DialogBox, { open: true, title: 'Title', ...props }, () => h('p', 'Body')),
  })
  app.use(testI18n)
  app.mount(container)
  apps.push(app)

  const dialog = container.querySelector('dialog')!
  return {
    dialog,
    form: dialog.querySelector('form')!,
    confirmButton: dialog.querySelector<HTMLButtonElement>('button[type="submit"]'),
  }
}

const flushPromises = () => new Promise(resolve => setTimeout(resolve))

useNativeDialogStubs()

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('dialogBox', () => {
  it('awaits onConfirm while busy and inert, then closes', async () => {
    let resolveConfirm!: () => void
    const onConfirm = vi.fn(() => new Promise<void>(resolve => resolveConfirm = resolve))
    const { dialog, form, confirmButton } = mountDialogBox({ onConfirm })
    await nextTick()
    expect(confirmButton).not.toBeNull()

    form.requestSubmit()
    form.requestSubmit()
    await nextTick()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(form.inert).toBe(true)
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(dialog.getAttribute('closedby')).toBe('none')
    expect(document.activeElement).toBe(dialog)
    expect(dialog.open).toBe(true)

    resolveConfirm()
    await flushPromises()
    expect(dialog.open).toBe(false)
    expect(close).toHaveBeenCalledWith('confirm')
  })

  it('stays open and refocuses confirm when onConfirm returns false or throws', async () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const error = new Error('boom')
    const onConfirm = vi.fn<() => unknown>().mockResolvedValueOnce(false).mockRejectedValueOnce(error)
    const { dialog, form, confirmButton } = mountDialogBox({ onConfirm })
    await nextTick()

    form.requestSubmit()
    await flushPromises()
    expect(dialog.open).toBe(true)
    expect(form.inert).toBe(false)
    expect(document.activeElement).toBe(confirmButton)

    form.requestSubmit()
    await flushPromises()
    expect(dialog.open).toBe(true)
    expect(reportError).toHaveBeenCalledWith(error)
  })

  it('has no footer without onConfirm, and Enter on the dialog itself still confirms', async () => {
    const { dialog, confirmButton } = mountDialogBox()
    await nextTick()
    expect(confirmButton).toBeNull()
    expect(dialog.querySelector('.b-dialog-box__foot')).toBeNull()

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await flushPromises()
    expect(close).toHaveBeenCalledWith('confirm')
    expect(dialog.open).toBe(false)
  })
})
