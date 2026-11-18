<script lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import ALink from '~/components/ALink.vue'
import OverlayScrollbarsComponent from '~/components/OverlayScrollbarsComponent'
import type { LiveParentArea, WebAreaListResult } from '~/models/live/getWebAreaList'
import api from '~/utils/api'

let cachedParentAreas: LiveParentArea[] | null = null
let pendingAreasRequest: Promise<LiveParentArea[] | null> | null = null

async function fetchLiveAreas(): Promise<LiveParentArea[] | null> {
  if (cachedParentAreas)
    return cachedParentAreas

  if (!pendingAreasRequest) {
    pendingAreasRequest = api.live.getWebAreaList({ source_id: 2 })
      .then((res: WebAreaListResult) => {
        if (res?.code === 0 && Array.isArray(res.data?.data) && res.data.data.length > 0) {
          cachedParentAreas = res.data.data
          return cachedParentAreas
        }
        return null
      })
      .catch(() => null)
      .finally(() => {
        pendingAreasRequest = null
      })
  }

  return pendingAreasRequest
}
</script>

<script setup lang="ts">
const OPEN_DELAY = 90
const CLOSE_DELAY = 140
const SUB_MENU_GAP = 6

// 有哪些父分区、它们的顺序和子分区以接口为准，这里只按编号补上接口没有的图标、颜色和译名
const AREA_DECOR: Record<number, { key: string, icon: string, color: string }> = {
  2: { key: 'online_games', icon: 'i-mingcute:sword-line', color: '#60A5FA' },
  3: { key: 'mobile_games', icon: 'i-mingcute:cellphone-line', color: '#34D399' },
  6: { key: 'standalone_games', icon: 'i-mingcute:game-2-line', color: '#A78BFA' },
  9: { key: 'vtubers', icon: 'i-mingcute:sparkles-line', color: '#F472B6' },
  1: { key: 'entertainment', icon: 'i-mingcute:movie-line', color: '#FB7185' },
  5: { key: 'radio', icon: 'i-mingcute:mic-line', color: '#38BDF8' },
  13: { key: 'esports', icon: 'i-mingcute:trophy-line', color: '#FBBF24' },
  14: { key: 'chat_room', icon: 'i-mingcute:chat-1-line', color: '#2DD4BF' },
  10: { key: 'life', icon: 'i-mingcute:home-5-line', color: '#4ADE80' },
  11: { key: 'knowledge', icon: 'i-mingcute:bulb-line', color: '#FACC15' },
  301: { key: 'help_play', icon: 'i-mingcute:game-1-line', color: '#818CF8' },
  15: { key: 'interactive', icon: 'i-mingcute:magic-2-line', color: '#C084FC' },
  16: { key: 'shopping', icon: 'i-mingcute:shopping-bag-2-line', color: '#FB923C' },
}

// 接口返回之前和请求失败时显示的父分区
const FALLBACK_PARENT_AREAS: LiveParentArea[] = [2, 3, 6, 9, 1, 5, 13, 14, 10, 11, 301, 15, 16]
  .map(id => ({ id, name: '', list: [] }))

const HELP_PLAY_AREA_ID = 301

function getAreaUrl(parentAreaId: number, areaId: string | number = 0): string {
  const query = `parentAreaId=${parentAreaId}&areaId=${areaId}`
  return parentAreaId === HELP_PLAY_AREA_ID
    ? `https://live.bilibili.com/p/html/play-together-area/index.html?${query}`
    : `https://live.bilibili.com/p/eden/area-tags?${query}`
}

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const subMenuRef = ref<HTMLElement | null>(null)
const itemRefs = new Map<number, HTMLElement>()

const parentAreas = ref<LiveParentArea[]>(cachedParentAreas ?? FALLBACK_PARENT_AREAS)
const hoveredParentId = ref<number | null>(null)
const activeParentId = ref<number | null>(null)
const subMenuPos = reactive({ left: 0, top: 0 })
const isSubMenuFlippedLeft = ref(false)

let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

const parentCategories = computed(() =>
  parentAreas.value.map((area) => {
    const id = Number(area.id)
    const decor = AREA_DECOR[id]
    return {
      id,
      name: decor ? t(`topbar.live_dropdown.${decor.key}`) : area.name,
      icon: decor?.icon ?? 'i-mingcute:live-line',
      color: decor?.color ?? 'var(--bew-theme-color)',
      subAreas: area.list ?? [],
    }
  }),
)

const parentCategoryColumns = computed(() => {
  const half = Math.ceil(parentCategories.value.length / 2)
  return [parentCategories.value.slice(0, half), parentCategories.value.slice(half)]
})

const activeParentCategory = computed(() =>
  parentCategories.value.find(category => category.id === activeParentId.value) ?? null,
)

function hasSubAreas(parentId: number): boolean {
  return parentCategories.value.some(category => category.id === parentId && category.subAreas.length > 0)
}

function setItemRef(id: number, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement)
    itemRefs.set(id, el)
  else
    itemRefs.delete(id)
}

function clearOpenTimer() {
  if (openTimer !== undefined) {
    clearTimeout(openTimer)
    openTimer = undefined
  }
}

function clearCloseTimer() {
  if (closeTimer !== undefined) {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

function clearTimers() {
  clearOpenTimer()
  clearCloseTimer()
}

function updateSubMenuPosition() {
  if (activeParentId.value === null || !rootRef.value)
    return

  const itemEl = itemRefs.get(activeParentId.value)
  if (!itemEl)
    return

  const rootRect = rootRef.value.getBoundingClientRect()
  const itemRect = itemEl.getBoundingClientRect()
  const menuWidth = subMenuRef.value?.offsetWidth ?? 0
  const menuHeight = subMenuRef.value?.offsetHeight ?? 0

  let left = Math.round(itemRect.right - rootRect.left + SUB_MENU_GAP)
  let flipped = false

  if (
    menuWidth > 0
    && itemRect.right + SUB_MENU_GAP + menuWidth > window.innerWidth - 12
    && itemRect.left - SUB_MENU_GAP - menuWidth >= 8
  ) {
    left = Math.round(itemRect.left - rootRect.left - menuWidth - SUB_MENU_GAP)
    flipped = true
  }

  let top = Math.round(itemRect.top - rootRect.top)
  if (menuHeight > 0 && itemRect.top + menuHeight > window.innerHeight - 16)
    top = Math.max(0, Math.round(window.innerHeight - 16 - menuHeight - rootRect.top))

  subMenuPos.left = left
  subMenuPos.top = top
  isSubMenuFlippedLeft.value = flipped
}

function activateParent(categoryId: number) {
  if (!hasSubAreas(categoryId)) {
    activeParentId.value = null
    return
  }

  activeParentId.value = categoryId
  updateSubMenuPosition()
  void nextTick(() => updateSubMenuPosition())
}

function resetSubMenu() {
  clearTimers()
  hoveredParentId.value = null
  activeParentId.value = null
}

function scheduleCloseSubMenu() {
  clearCloseTimer()
  if (activeParentId.value === null)
    return

  closeTimer = setTimeout(() => {
    closeTimer = undefined
    activeParentId.value = null
  }, CLOSE_DELAY)
}

function handleItemMouseEnter(categoryId: number) {
  hoveredParentId.value = categoryId
  clearOpenTimer()

  if (activeParentId.value === categoryId) {
    clearCloseTimer()
    return
  }

  openTimer = setTimeout(() => {
    openTimer = undefined
    clearCloseTimer()
    activateParent(categoryId)
  }, OPEN_DELAY)
}

function handleItemMouseLeave() {
  clearOpenTimer()
  if (activeParentId.value !== null)
    scheduleCloseSubMenu()
}

function handleMenuMouseEnter() {
  clearTimers()
  if (activeParentId.value !== null)
    hoveredParentId.value = activeParentId.value
}

function handleItemFocusIn(categoryId: number) {
  clearTimers()
  hoveredParentId.value = categoryId
  activateParent(categoryId)
}

function handleRootMouseLeave() {
  clearOpenTimer()
  hoveredParentId.value = null
  scheduleCloseSubMenu()
}

function handleFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  const nextTarget = event.relatedTarget as Node | null
  if (currentTarget && (!nextTarget || !currentTarget.contains(nextTarget)))
    resetSubMenu()
}

function handleEscape() {
  resetSubMenu()
}

watch(parentCategories, () => {
  if (hoveredParentId.value !== null && activeParentId.value === null && hasSubAreas(hoveredParentId.value))
    activateParent(hoveredParentId.value)
})

onMounted(() => {
  if (cachedParentAreas)
    return

  void fetchLiveAreas().then((areas) => {
    if (areas)
      parentAreas.value = areas
  })
})

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <div
    ref="rootRef"
    class="live-channels-pop"
    @mouseleave="handleRootMouseLeave"
    @focusout="handleFocusOut"
    @keydown.esc="handleEscape"
  >
    <OverlayScrollbarsComponent
      class="area-panel"
      element="div"
      defer
      :options="{
        x: 'hidden',
        y: 'scroll',
      }"
      style="backdrop-filter: var(--bew-filter-glass-1);"
      h="fit"
      max-h="[min(445px,calc(100vh-100px))]"
      w="[calc(100vw-100px)]"
      max-w="fit"
      shadow="[var(--bew-shadow-3),var(--bew-shadow-edge-glow-1)]"
      bg="$bew-elevated-alt"
      rounded="$bew-radius"
      border="1 $bew-border-color"
    >
      <div p="4" w-inherit>
        <ul
          class="quick-nav"
          @mouseenter="resetSubMenu"
        >
          <li class="link-item !mb-0">
            <a href="https://www.bilibili.com" target="_top">
              <div class="icon">
                <i i-tabler:brand-bilibili text="$bew-theme-color" />
              </div>
              <span>{{ $t('topbar.live_dropdown.back_to_main') }}</span>
            </a>
          </li>
          <li class="link-item !mb-0">
            <ALink
              href="https://live.bilibili.com/p/eden/rank"
              type="topBar"
            >
              <div class="icon">
                <i i-mingcute:trophy-line style="color: #F59E0B" />
              </div>
              <span>{{ $t('topbar.live_dropdown.live_rank') }}</span>
            </ALink>
          </li>
        </ul>

        <div flex="~ gap-1">
          <ul
            v-for="(column, index) in parentCategoryColumns"
            :key="index"
            class="link-list"
          >
            <li
              v-for="category in column"
              :key="category.id"
              :ref="el => setItemRef(category.id, el)"
              class="link-item"
              @mouseenter="handleItemMouseEnter(category.id)"
              @mouseleave="handleItemMouseLeave"
              @focusin="handleItemFocusIn(category.id)"
            >
              <ALink
                :href="getAreaUrl(category.id)"
                type="topBar"
                :class="{ active: activeParentId === category.id && category.subAreas.length > 0 }"
              >
                <div class="icon">
                  <i :class="category.icon" :style="{ color: category.color }" />
                </div>
                <span class="flex-1">{{ category.name }}</span>
                <i
                  v-if="category.subAreas.length > 0"
                  i-mingcute:right-line
                  aria-hidden="true"
                  class="ml-2 text-xs text-$bew-text-3"
                />
              </ALink>
            </li>
          </ul>
        </div>
      </div>
    </OverlayScrollbarsComponent>

    <Transition name="sub-menu">
      <div
        v-if="activeParentCategory && activeParentCategory.subAreas.length > 0"
        ref="subMenuRef"
        class="sub-area-menu"
        :class="{ 'is-flipped-left': isSubMenuFlippedLeft }"
        :style="{ left: `${subMenuPos.left}px`, top: `${subMenuPos.top}px` }"
        @mouseenter="handleMenuMouseEnter"
        @mouseleave="scheduleCloseSubMenu()"
      >
        <ul class="sub-area-list">
          <li
            v-for="sub in activeParentCategory.subAreas"
            :key="sub.id"
          >
            <ALink
              :href="getAreaUrl(activeParentCategory.id, sub.id)"
              type="topBar"
              class="sub-area-item"
            >
              <span class="truncate">{{ sub.name }}</span>
            </ALink>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.live-channels-pop {
  --uno: "!overflow-visible";

  /* 毛玻璃在里面的两块面板上，根元素要一直不透明，淡入淡出由面板自己做 */
  opacity: 1 !important;
}

.area-panel,
.sub-area-menu {
  opacity: var(--bew-popover-opacity, 1);
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep([data-overlayscrollbars-viewport]) {
  overscroll-behavior: contain;
}

.quick-nav {
  --uno: "grid grid-cols-2 gap-1 pb-2.5 mb-2.5 border-b border-$bew-border-color";
}

.link-item {
  --uno: "mb-1 last-of-type:mb-0 text-sm";

  a {
    --uno: "flex items-center text-nowrap min-w-160px h-38px p-2 pr-3 rounded-$bew-radius duration-300";
    --uno: "hover:bg-$bew-fill-alt hover:shadow-[var(--bew-shadow-1),var(--bew-shadow-edge-glow-1)]";
  }

  a.active {
    --uno: "bg-$bew-fill-alt shadow-[var(--bew-shadow-1),var(--bew-shadow-edge-glow-1)]";
  }
}

.icon {
  --uno: "w-2em h-2em mr-3 bg-$bew-content-solid vertical-bottom fill-current overflow-hidden";
  --uno: "text-1.25em grid place-items-center rounded-1/2 shrink-0";
  --uno: "border-1 border-$bew-border-color";
}

.sub-area-menu {
  --uno: "absolute z-20 min-w-156px w-max max-w-220px p-2.5 rounded-$bew-radius border-1 border-$bew-border-color bg-$bew-elevated";
  --uno: "shadow-[var(--bew-shadow-edge-glow-1),var(--bew-shadow-3)] overflow-visible";
  backdrop-filter: var(--bew-filter-glass-1);

  &::before {
    content: "";
    position: absolute;
    top: -6px;
    bottom: -6px;
    left: -10px;
    width: 12px;
  }

  &.is-flipped-left::before {
    left: auto;
    right: -10px;
  }
}

.sub-area-list {
  --uno: "flex flex-col gap-1 max-h-[min(340px,calc(100vh-100px))] overflow-y-auto";
  overscroll-behavior: contain;
}

.sub-area-item {
  --uno: "flex items-center w-full h-36px px-3.5 rounded-$bew-radius text-sm text-$bew-text-1 whitespace-nowrap duration-200";
  --uno: "hover:bg-$bew-fill-2";
}

.sub-menu-enter-active,
.sub-menu-leave-active {
  transition:
    opacity 0.15s ease,
    translate 0.15s ease;
}

.sub-menu-enter-from,
.sub-menu-leave-to {
  opacity: 0;
  translate: -4px 0;
}

.sub-area-menu.is-flipped-left.sub-menu-enter-from,
.sub-area-menu.is-flipped-left.sub-menu-leave-to {
  translate: 4px 0;
}

@media (prefers-reduced-motion: reduce) {
  .link-item a,
  .sub-area-item,
  .sub-menu-enter-active,
  .sub-menu-leave-active {
    transition: none;
  }

  .sub-menu-enter-from,
  .sub-menu-leave-to {
    translate: 0 0;
  }
}
</style>
