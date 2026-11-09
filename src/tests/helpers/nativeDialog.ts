import { afterEach, beforeEach, vi } from 'vitest'

// jsdom没有实现模态dialog、popover与Web Animations，这里只模拟组件依赖的那部分行为
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
/** `CSS.supports('overlay', 'auto')`的结果，默认按支持算；置假可以测“先退场再关闭”的退路 */
export const supportsOverlay = vi.fn(() => true)

export class FakeKeyframeEffect {
  constructor(readonly target: Element, private readonly endTime: number) {}

  getComputedTiming() {
    return { endTime: this.endTime }
  }
}

/** 在当前`describe`里为每个用例安装并还原上述桩 */
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
      // jsdom没有`inert`属性，补一个反映attribute的，Vue才会像在浏览器里一样按属性赋值
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
