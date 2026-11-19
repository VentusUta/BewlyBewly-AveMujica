<script setup lang="ts">
import { settings } from '~/logic'

import { useTopBarPopup } from '../composables/useTopBarPopups'

const {
  popupKey,
  badgeCount = 0,
  keep,
} = defineProps<{
  popupKey?: string
  badgeCount?: number
  /** 悬浮卡关闭后仍保留：`mounted`随条目一起挂载，`opened`在首次打开后才保留 */
  keep?: 'mounted' | 'opened'
}>()

const emit = defineEmits<{
  open: []
  close: []
}>()

const itemRef = ref<HTMLElement | null>(null)
const popup = popupKey ? useTopBarPopup(popupKey, itemRef) : null
const isOpen = computed(() => popup?.isOpen.value ?? false)

const hasOpened = ref(false)
const kept = computed(() => keep === 'mounted' || (keep === 'opened' && hasOpened.value))

watch(isOpen, (open) => {
  if (open) {
    hasOpened.value = true
    emit('open')
  }
  else {
    emit('close')
  }
})

defineExpose({
  isOpen,
})
</script>

<template>
  <div
    ref="itemRef"
    class="nav-item"
    :class="{ active: isOpen }"
    @click="event => popup?.handleClick(event)"
  >
    <template v-if="badgeCount > 0">
      <div
        v-if="settings.topBarIconBadges === 'number'"
        class="unread-num-dot"
      >
        {{ badgeCount > 99 ? '99+' : badgeCount }}
      </div>
      <div
        v-else-if="settings.topBarIconBadges === 'dot'"
        class="unread-dot"
      />
    </template>

    <slot />

    <Transition name="slide-in">
      <div
        v-if="$slots.popover && (kept || isOpen)"
        v-show="!kept || isOpen"
        class="bew-popover"
        @click.stop
      >
        <slot name="popover" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  --uno: "transition-all duration-250 pointer-events-none transform-gpu";
}

/*
 * 淡入淡出不能加在这层上：祖先一旦半透明，Safari里卡片的毛玻璃要等过渡结束才出现。
 * 这里只给出`--bew-popover-opacity`，由带毛玻璃的那层自己用它，默认是卡片的根元素。
 */
.slide-in-leave-to,
.slide-in-enter-from {
  --uno: "transform mt--10px";
  --bew-popover-opacity: 0;
}

.slide-in-enter-active > :deep(*),
.slide-in-leave-active > :deep(*) {
  --uno: "transition-opacity duration-250";
}

.bew-popover {
  position: absolute;
  top: 50px;
  left: 50%;
  translate: round(nearest, -50%, 1px) 0;
}

.bew-popover > :deep(*) {
  opacity: var(--bew-popover-opacity, 1);
  overflow: hidden;

  /* 只设在弹窗根上：设在后代上会拦住缩略图等 overflow: hidden 元素上的滚轮，列表本身就滚不动了 */
  overscroll-behavior: contain;
}

.unread-num-dot {
  --uno: "absolute top--2px right--4px";
  --uno: "important:px-1 rounded-full";
  --uno: "text-xs leading-0 z-6 min-w-14px h-14px";
  --uno: "grid place-items-center";
  --uno: "bg-$bew-theme-color text-white shadow-$bew-shadow-1";
}

.unread-dot {
  --uno: "w-8px h-8px bg-$bew-theme-color rounded-8px absolute right-2px top-2px";
}

.nav-item {
  --uno: "relative text-$bew-text-1 flex items-center";
}

.nav-item.active::after {
  content: "";
  position: absolute;
  top: 32px;
  left: 50%;
  translate: -50% 0;
  width: 48px;
  height: 22px;
}

.nav-item > :deep(a) {
  --uno: "text-lg grid place-items-center rounded-40px duration-300 relative z-5";
  --uno: "h-34px w-34px";
  filter: drop-shadow(0 0 4px var(--bew-bg));
}

.nav-item.active > :deep(a),
.nav-item > :deep(a:hover) {
  --uno: "bg-$bew-fill-2";
}

.nav-item > :deep(a.accent) {
  --uno: "bg-$bew-theme-color-20 hover:bg-$bew-theme-color-40 text-$bew-theme-color";
}

.nav-item.active > :deep(a.accent) {
  --uno: "bg-$bew-theme-color-40";
}

.force-white-icon .nav-item > :deep(a) {
  --uno: "text-white";
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.6)) !important;
}

.force-white-icon .nav-item.active > :deep(a),
.force-white-icon .nav-item > :deep(a:hover) {
  --uno: "bg-white bg-opacity-20";
}

.force-white-icon .nav-item > :deep(a.accent) {
  --uno: "!bg-white !bg-opacity-20 hover:!bg-white hover:!bg-opacity-40 !filter-none";
  --uno: "!text-white";
}

.force-white-icon .nav-item.active > :deep(a.accent) {
  --uno: "!bg-white !bg-opacity-40";
}
</style>
