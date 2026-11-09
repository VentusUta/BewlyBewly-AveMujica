<!--
  模态对话框原语，提供：
  - `dialog`：原生`<dialog>`元素
  - `showModal()`：以模态方式打开
  - `close(returnValue?)`：关闭，不派发`cancel`，并会先关闭子树中仍打开的dialog与popover
  - `requestClose(returnValue?)`：请求关闭，先派发`cancel`，受`closedby`约束
  - `close`事件：对话框已被关掉、结果已定，在退场动画开始时派发，`v-model:open`同时变回`false`。
    它是组件自己发的，不是`<dialog>`的原生`close`：后者在有的浏览器里要等退场播完才来（见`exitsAfterClose`）
  - `closed`事件：退场动画播完后派发；用`v-if`卸载对话框的调用方应等这个事件，否则退场动画会被切断
  - 自带轻提示区：打开期间轻提示渲染在对话框里，不受`inert`影响
  - 键盘事件不冒泡出对话框：页面虽然`inert`，按键仍会传到页面自己的监听器。
    B站播放器会对Esc和方向键`preventDefault`，不拦住的话视频页上Esc关不掉、单选组的方向键也失效
-->
<script setup lang="ts">
import ToastRegion from '~/components/ToastRegion.vue'
import { useDocumentScrollLock } from '~/composables/useDocumentScrollLock'

export type DialogClosedBy = 'any' | 'closerequest' | 'none'

const props = withDefaults(defineProps<{
  closedby?: DialogClosedBy
}>(), {
  closedby: 'any',
})

const emit = defineEmits<{
  cancel: [event: Event]
  close: []
  closed: []
}>()

const open = defineModel<boolean>('open', { default: false })

const dialogRef = useTemplateRef<HTMLDialogElement>('dialog')
const isModal = ref(false)
useDocumentScrollLock(isModal)

let lightDismissArmed = false
/** `open`：已打开；`exiting`：已发出`close`，退场还没结束；`closed`：其余时候 */
let phase: 'closed' | 'open' | 'exiting' = 'closed'
/** 每次开始或作废“先退场再关闭”时递增，用来丢弃过期的等待 */
let exitRun = 0
let requestedReturnValue: string | undefined

onMounted(() => sync(open.value))
onActivated(() => sync(open.value))
onDeactivated(() => closeNow())
onBeforeUnmount(() => closeNow())

watch(open, sync)

function sync(shouldOpen: boolean) {
  if (shouldOpen)
    showModal()
  else
    close()
}

/**
 * 支持`overlay`过渡的浏览器（目前只有Chrome）里，dialog关闭后还能留在top layer里把退场播完，所以直接关闭。
 * 其余浏览器一关闭dialog就掉出top layer，只能先播退场、播完再关闭。样式里用同一个条件分成两套
 */
function exitsAfterClose(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('overlay', 'auto')
}

function showModal() {
  const dialog = dialogRef.value
  if (!dialog)
    return
  if (dialog.open) {
    // 还开着但正在先退场：撤销退场，当作重新打开
    if (dialog.hasAttribute('data-closing')) {
      abortExit(dialog)
      phase = 'open'
      isModal.value = true
    }
    return
  }

  lightDismissArmed = false
  dialog.showModal()
  if (dialog.open) {
    phase = 'open'
    isModal.value = true
  }
}

/** 向调用方宣告关闭，并交还滚动锁与轻提示。两种退场方式都在退场开始时调用它 */
function announceClose() {
  if (phase !== 'open')
    return

  phase = 'exiting'
  isModal.value = false
  open.value = false
  emit('close')
}

function close(returnValue?: string) {
  const dialog = dialogRef.value
  if (dialog?.open && !exitsAfterClose())
    void exitThenClose(dialog, returnValue)
  else
    closeNow(returnValue)
}

/** 不播退场，立即关闭。卸载和停用时没有时间等动画 */
function closeNow(returnValue?: string) {
  const dialog = dialogRef.value
  if (!dialog)
    return

  abortExit(dialog)
  closeDescendants(dialog)
  if (dialog.open)
    dialog.close(returnValue)
}

function closeDescendants(dialog: HTMLDialogElement) {
  const nested = [...dialog.querySelectorAll<HTMLElement>('dialog[open], [popover]')].reverse()
  for (const element of nested) {
    if (element instanceof HTMLDialogElement)
      element.close()
    else
      element.hidePopover()
  }
}

async function exitThenClose(dialog: HTMLDialogElement, returnValue?: string) {
  if (dialog.hasAttribute('data-closing'))
    return

  const run = ++exitRun
  closeDescendants(dialog)
  announceClose()
  // 退场期间dialog还开着，不能再让它响应点击和按键
  dialog.inert = true
  dialog.setAttribute('data-closing', '')
  await waitForExit(dialog)
  if (run === exitRun)
    closeNow(returnValue)
}

function abortExit(dialog: HTMLDialogElement) {
  exitRun++
  dialog.inert = false
  dialog.removeAttribute('data-closing')
}

function requestClose(returnValue?: string) {
  // `cancel`在`requestClose()`里同步派发，`handleCancel`拦下原生关闭时要靠它带上返回值
  requestedReturnValue = returnValue
  dialogRef.value?.requestClose(returnValue)
  requestedReturnValue = undefined
}

function handleCancel(event: Event) {
  if (props.closedby === 'none')
    event.preventDefault()
  emit('cancel', event)
  if (event.defaultPrevented || exitsAfterClose())
    return

  // 把这次原生关闭换成先退场再关闭。浏览器不让连续拦截时`cancel`不可取消，那一次只能直接关
  if (event.cancelable) {
    event.preventDefault()
    void exitThenClose(event.currentTarget as HTMLDialogElement, requestedReturnValue)
  }
}

function handleClose(event: Event) {
  const dialog = event.currentTarget as HTMLDialogElement
  // 重新打开之后才到的旧`close`事件不算
  if (phase === 'closed' || dialog.open)
    return

  abortExit(dialog)
  announceClose()
  phase = 'closed'
  void waitForExit(dialog).then(() => {
    if (!dialog.open)
      emit('closed')
  })
}

/** 只等dialog自身与`::backdrop`上有限时长的动画；子树里的无限动画（如加载图标）不算 */
async function waitForExit(dialog: HTMLDialogElement) {
  const animations = dialog.getAnimations({ subtree: true }).filter((animation) => {
    const effect = animation.effect
    return effect instanceof KeyframeEffect
      && effect.target === dialog
      && effect.getComputedTiming().endTime !== Infinity
  })
  await Promise.allSettled(animations.map(animation => animation.finished))
}

function hasNativeClosedBy(dialog: HTMLDialogElement): boolean {
  return 'closedBy' in dialog
}

function isOnBackdrop(dialog: HTMLDialogElement, event: PointerEvent): boolean {
  if (event.target !== dialog)
    return false

  const rect = dialog.getBoundingClientRect()
  return event.clientX < rect.left
    || event.clientX > rect.right
    || event.clientY < rect.top
    || event.clientY > rect.bottom
}

function handlePointerDown(event: PointerEvent) {
  const dialog = event.currentTarget as HTMLDialogElement
  lightDismissArmed = props.closedby === 'any'
    && !hasNativeClosedBy(dialog)
    && isOnBackdrop(dialog, event)
}

function handlePointerUp(event: PointerEvent) {
  const dialog = event.currentTarget as HTMLDialogElement
  if (lightDismissArmed && isOnBackdrop(dialog, event))
    dialog.requestClose()
  lightDismissArmed = false
}

defineExpose({ dialog: dialogRef, showModal, close, requestClose })
</script>

<template>
  <dialog
    ref="dialog"
    class="b-dialog"
    tabindex="-1"
    :closedby="closedby"
    @cancel="handleCancel"
    @close="handleClose"
    @keydown.stop
    @keypress.stop
    @keyup.stop
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
    @pointercancel="lightDismissArmed = false"
  >
    <slot :close="close" :request-close="requestClose" />
    <ToastRegion :active="isModal" />
  </dialog>
</template>

<style scoped>
:where(.b-dialog) {
  --b-dialog-duration: 500ms;
  --b-dialog-easing: cubic-bezier(0.4, 0, 0.2, 1);
  --b-dialog-hidden-transform: scale(1.05);
  --b-dialog-backdrop: rgb(0 0 0 / 40%);

  box-sizing: border-box;
  max-width: calc(100% - 2em);
  max-height: calc(100% - 2em);
  padding: 0;
  overscroll-behavior: contain;
  border: 0;
  color: inherit;
  background: none;

  /* 手动固定一些UA样式表对`dialog:modal`的设定，以避免退场过渡期间（已无`:modal`时）掉样式 */
  position: fixed;
  overflow: auto;
  inset-block: 0;
}

:where(.b-dialog)::backdrop {
  overflow: hidden;
  overscroll-behavior: contain;
  background: var(--b-dialog-backdrop);
}

@media (prefers-reduced-motion: no-preference) {
  /* 进场：过渡取自打开后的样式，起点由`@starting-style`给出 */
  :where(.b-dialog[open]) {
    transition:
      opacity var(--b-dialog-duration) var(--b-dialog-easing),
      transform var(--b-dialog-duration) var(--b-dialog-easing);
  }

  :where(.b-dialog[open])::backdrop {
    transition: opacity var(--b-dialog-duration) var(--b-dialog-easing);
  }

  /*
   * 退场，对应脚本里的`exitsAfterClose`。支持`overlay`的浏览器：关闭后dialog留在top layer里，过渡取自关闭后的样式。
   * 其余浏览器若也推迟`display`，dialog会以普通fixed元素被页面压住，所以由脚本先加`data-closing`播完再关闭。
   */
  @supports (overlay: auto) {
    :where(.b-dialog) {
      opacity: 0;
      transform: var(--b-dialog-hidden-transform);
      transition:
        opacity var(--b-dialog-duration) var(--b-dialog-easing),
        transform var(--b-dialog-duration) var(--b-dialog-easing),
        display var(--b-dialog-duration) allow-discrete,
        overlay var(--b-dialog-duration) allow-discrete;
    }

    :where(.b-dialog)::backdrop {
      opacity: 0;
      transition:
        opacity var(--b-dialog-duration) var(--b-dialog-easing),
        display var(--b-dialog-duration) allow-discrete,
        overlay var(--b-dialog-duration) allow-discrete;
    }

    :where(.b-dialog[open]) {
      opacity: 1;
      transform: none;
    }

    :where(.b-dialog[open])::backdrop {
      opacity: 1;
    }
  }

  @supports not (overlay: auto) {
    :where(.b-dialog[data-closing]) {
      opacity: 0;
      transform: var(--b-dialog-hidden-transform);
    }

    :where(.b-dialog[data-closing])::backdrop {
      opacity: 0;
    }
  }

  /* 必须写在最后：与上面的`[open]`规则优先级相同，靠书写顺序胜出 */
  @starting-style {
    :where(.b-dialog[open]) {
      opacity: 0;
      transform: var(--b-dialog-hidden-transform);
    }

    :where(.b-dialog[open])::backdrop {
      opacity: 0;
    }
  }
}
</style>
