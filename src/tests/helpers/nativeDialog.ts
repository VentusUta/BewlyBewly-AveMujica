import { afterEach, beforeEach, vi } from 'vitest'

const dialogPrototype = HTMLDialogElement.prototype
const elementPrototype = HTMLElement.prototype
const stubbedDialogNames = ['showModal', 'close', 'requestClose', 'getAnimations'] as const
const stubbedElementNames = ['showPopover', 'hidePopover', 'inert'] as const
const originalDescriptors = [
  ...stubbedDialogNames.map(name => [dialogPrototype, name, Object.getOwnPropertyDescriptor(dialogPrototype, name)] as const),
  ...stubbedElementNames.map(name => [elementPrototype, name, Object.getOwnPropertyDescriptor(elementPrototype, name)] as const),
]

export const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true
})
export const close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event('close'))
})
export const requestClose = vi.fn(function (this: HTMLDialogElement) {
  const cancelEvent = new Event('cancel', { cancelable: true })
  this.dispatchEvent(cancelEvent)
  if (!cancelEvent.defaultPrevented)
    this.close()
})
export const showPopover = vi.fn()
export const hidePopover = vi.fn()
export const supportsOverlay = vi.fn(() => true)

export class FakeKeyframeEffect {
  constructor(readonly target: Element, private readonly endTime: number) {}

  getComputedTiming() {
    return { endTime: this.endTime }
  }
}

export function useNativeDialogStubs() {
  beforeEach(() => {
    Object.defineProperties(dialogPrototype, {
      showModal: { configurable: true, writable: true, value: showModal },
      close: { configurable: true, writable: true, value: close },
      requestClose: { configurable: true, writable: true, value: requestClose },
      getAnimations: { configurable: true, writable: true, value: () => [] },
    })
    Object.defineProperties(elementPrototype, {
      showPopover: { configurable: true, writable: true, value: showPopover },
      hidePopover: { configurable: true, writable: true, value: hidePopover },
      inert: {
        configurable: true,
        get(this: HTMLElement) {
          return this.hasAttribute('inert')
        },
        set(this: HTMLElement, value: boolean) {
          this.toggleAttribute('inert', value)
        },
      },
    })
    vi.stubGlobal('KeyframeEffect', FakeKeyframeEffect)
    vi.stubGlobal('CSS', { supports: supportsOverlay })
    supportsOverlay.mockReturnValue(true)
    for (const mock of [showModal, close, requestClose, showPopover, hidePopover])
      mock.mockClear()
  })

  afterEach(() => {
    for (const [prototype, name, descriptor] of originalDescriptors) {
      if (descriptor)
        Object.defineProperty(prototype, name, descriptor)
      else
        Reflect.deleteProperty(prototype, name)
    }
    vi.unstubAllGlobals()
  })
}
