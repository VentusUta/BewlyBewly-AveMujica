<!--
  轻提示区 ToastRegion
  栈式设计，由App持有根区，模态对话框各自持有子区，打开时接管轻提示，关闭后交还；
  设计原因是需要`popover=manual`以保证画在当前最上层（包括模态对话框之上）。
  轻提示仅有自动消失与悬停暂停的状态，且不承接焦点。
-->
<script setup lang="ts">
import type { ToastType } from '~/composables/useToast'
import { pauseToasts, resumeToasts, toasts, useToastRegion } from '~/composables/useToast'

const props = withDefaults(defineProps<{
  active?: boolean
}>(), {
  active: true,
})

const icons: Record<ToastType, string> = {
  success: 'i-mingcute:check-circle-fill',
  error: 'i-mingcute:close-circle-fill',
  warning: 'i-mingcute:alert-fill',
  info: 'i-mingcute:information-fill',
}

const { isTop } = useToastRegion(() => props.active)
const regionRef = useTemplateRef<HTMLElement>('region')

const shownToasts = computed(() => isTop.value ? toasts : [])
const visible = computed(() => shownToasts.value.length > 0)

let announceAfterId = 0
watch(isTop, (top) => {
  if (top)
    announceAfterId = toasts[0]?.id ?? 0
}, { immediate: true })
const announced = computed(() => shownToasts.value.filter(item => item.id > announceAfterId))
const politeToasts = computed(() => announced.value.filter(item => item.type !== 'error'))
const assertiveToasts = computed(() => announced.value.filter(item => item.type === 'error'))

watch(visible, (show) => {
  const region = regionRef.value
  if (!region)
    return

  if (show)
    region.showPopover()
  else
    region.hidePopover()
}, { flush: 'post' })
</script>

<template>
  <section
    ref="region"
    class="b-toasts"
    popover="manual"
    :aria-label="$t('common.notifications')"
    @pointerenter="pauseToasts"
    @pointerleave="resumeToasts"
  >
    <TransitionGroup tag="ol" name="b-toast" class="b-toasts__list">
      <li
        v-for="item in shownToasts"
        :key="item.id"
        class="b-toast"
        :class="`b-toast--${item.type}`"
      >
        <div class="b-toast__icon" :class="icons[item.type]" aria-hidden="true" />
        <p class="b-toast__message">
          {{ item.message }}
        </p>
      </li>
    </TransitionGroup>
  </section>

  <!-- 读屏播报区常驻，不随popover隐藏 -->
  <div class="b-toasts__live" role="status">
    <span v-for="item in politeToasts" :key="item.id">{{ item.message }}</span>
  </div>
  <div class="b-toasts__live" role="alert">
    <span v-for="item in assertiveToasts" :key="item.id">{{ item.message }}</span>
  </div>
</template>

<style scoped>
.b-toasts {
  /* 覆盖popover的UA样式 */
  position: fixed;
  inset: 1em 1em auto auto;
  inline-size: min(360px, 100% - 2em);
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  color: inherit;
  background: none;
  pointer-events: none;
}

.b-toasts__list {
  --uno: "m-0 p-0 list-none flex flex-col gap-2";
}

.b-toast {
  --b-toast-color: var(--bew-info-color);

  --uno: "grid items-start gap-3 px-4 py-3 antialiased";
  --uno: "rounded-$bew-radius border-1 border-$bew-border-color bg-$bew-elevated text-$bew-text-1";
  grid-template-columns: auto 1fr;
  border-style: solid;
  pointer-events: auto;
  backdrop-filter: var(--bew-filter-glass-2);
  box-shadow: var(--bew-shadow-2), var(--bew-shadow-edge-glow-1);
}

.b-toast--success {
  --b-toast-color: var(--bew-success-color);
}

.b-toast--error {
  --b-toast-color: var(--bew-error-color);
}

.b-toast--warning {
  --b-toast-color: var(--bew-warning-color);
}

.b-toast__icon {
  --uno: "text-xl mt-2px";
  color: var(--b-toast-color);
}

.b-toast__message {
  --uno: "m-0 text-sm lh-6";
  overflow-wrap: anywhere;
}

.b-toasts__live {
  --uno: "sr-only";
}

@media (prefers-reduced-motion: no-preference) {
  .b-toast-enter-active,
  .b-toast-leave-active,
  .b-toast-move {
    --uno: "transition-all duration-300";
  }

  .b-toast-enter-from,
  .b-toast-leave-to {
    --uno: "opacity-0 translate-x-4";
  }
}
</style>
