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
let phase: 'closed' | 'open' | 'exiting' = 'closed'
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

function exitsAfterClose(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('overlay', 'auto')
}

function showModal() {
  const dialog = dialogRef.value
  if (!dialog)
    return
  if (dialog.open) {
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

  if (event.cancelable) {
    event.preventDefault()
    void exitThenClose(event.currentTarget as HTMLDialogElement, requestedReturnValue)
  }
}

function handleClose(event: Event) {
  const dialog = event.currentTarget as HTMLDialogElement
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
  :where(.b-dialog[open]) {
    transition:
      opacity var(--b-dialog-duration) var(--b-dialog-easing),
      transform var(--b-dialog-duration) var(--b-dialog-easing);
  }

  :where(.b-dialog[open])::backdrop {
    transition: opacity var(--b-dialog-duration) var(--b-dialog-easing);
  }

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
