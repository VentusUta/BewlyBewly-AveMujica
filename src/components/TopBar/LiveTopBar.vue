<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ALink from '~/components/ALink.vue'
import { useDark } from '~/composables/useDark'
import { settings } from '~/logic'

import BaseTopBar from './BaseTopBar.vue'
import LiveChannelsPop from './components/LiveChannelsPop.vue'
import TopBarMomentsItem from './components/TopBarMomentsItem.vue'
import TopBarNavItem from './components/TopBarNavItem.vue'
import TopBarNotificationsItem from './components/TopBarNotificationsItem.vue'
import { useLiveTopBarForceWhite } from './composables/useLiveTopBarForceWhite'

const { t } = useI18n()
const baseTopBarRef = ref<InstanceType<typeof BaseTopBar> | null>(null)
const { isDark } = useDark()
const { forceWhiteIcon } = useLiveTopBarForceWhite()
const forceLightBar = computed(() => isDark.value && !forceWhiteIcon.value)

// 活动直播间用的是主站顶栏，它不吸顶，页面顶部紧接着就是可点击的内容
const isFixed = !document.querySelector('#biliMainHeader')

const liveMoreItems = computed(() => [
  { name: t('topbar.notifications'), url: 'https://message.bilibili.com', icon: 'i-mingcute:notification-line' },
  { name: t('topbar.moments'), url: 'https://t.bilibili.com/', icon: 'i-tabler:windmill' },
  { name: t('topbar.live_following'), url: 'https://link.bilibili.com/p/center/index#/user-center/follow/1', icon: 'i-mingcute:heart-line' },
  { name: t('topbar.start_streaming'), url: 'https://link.bilibili.com/p/center/index#/my-room/start-live', icon: 'i-mingcute:camcorder-line', target: '_blank' },
])

defineExpose({
  toggleTopBarVisible: (visible: boolean) => baseTopBarRef.value?.toggleTopBarVisible(visible),
  handleScroll: () => baseTopBarRef.value?.handleScroll(),
})
</script>

<template>
  <BaseTopBar
    ref="baseTopBarRef"
    :show-top-bar="settings.showTopBar"
    :is-fixed="isFixed"
    :force-white-icon="forceWhiteIcon"
    :force-light-bar="forceLightBar"
    search-type="live"
    logo-href="https://live.bilibili.com"
    :more-items="liveMoreItems"
  >
    <template #logo-popover>
      <LiveChannelsPop
        class="bew-popover"
        pos="!left-0 !top-50px"
        transform="!translate-x-0"
      />
    </template>

    <template #right-items="{ openNotificationsDrawer }">
      <TopBarMomentsItem />

      <TopBarNavItem>
        <ALink
          href="https://link.bilibili.com/p/center/index#/user-center/follow/1"
          :title="$t('topbar.live_following')"
          type="topBar"
        >
          <div i-mingcute:heart-line />
        </ALink>
      </TopBarNavItem>

      <div
        :class="forceWhiteIcon ? '!bg-white/30' : 'bg-$bew-border-color'"
        w-2px
        h-16px
        mx-1
        rounded-4px
      />

      <TopBarNavItem>
        <a
          class="accent"
          style="backdrop-filter: var(--bew-filter-glass-1);"
          href="https://link.bilibili.com/p/center/index#/my-room/start-live"
          target="_blank"
          :title="$t('topbar.start_streaming')"
        >
          <div i-mingcute:camcorder-line flex-shrink-0 />
        </a>
      </TopBarNavItem>

      <TopBarNotificationsItem @open-drawer="openNotificationsDrawer" />
    </template>
  </BaseTopBar>
</template>
