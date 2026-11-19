<script setup lang="ts">
import type { UnwrapNestedRefs } from 'vue'

import { settings } from '~/logic'
import { useSessionStore } from '~/stores/sessionStore'
import api from '~/utils/api'
import { stripBiliLangPrefix } from '~/utils/main'

import { updateInterval } from '../notify'
import type { UnReadDm, UnReadMessage } from '../types'
import NotificationsPop from './NotificationsPop.vue'
import TopBarNavItem from './TopBarNavItem.vue'

const emit = defineEmits<{
  openDrawer: [url?: string]
}>()

const session = useSessionStore()
const navItemRef = ref<InstanceType<typeof TopBarNavItem> | null>(null)

const unReadMessage = reactive<UnReadMessage | NonNullable<unknown>>(
  {},
) as UnwrapNestedRefs<UnReadMessage>
const unReadDm = reactive<UnReadDm>({} as UnwrapNestedRefs<UnReadDm>)
const unReadMessageCount = ref<number>(0)
let pollTimer: ReturnType<typeof setInterval> | undefined

async function getUnreadMessageCount() {
  if (session.status === 'loggedOut')
    return

  let result = 0

  try {
    let res = await api.notification.getUnreadMsg()
    if (res?.code === 0 && res.data) {
      Object.assign(unReadMessage, res.data)
      Object.entries(unReadMessage).forEach(([key, value]) => {
        if (key !== 'up' && key !== 'recv_reply' && key !== 'recv_like') {
          if (typeof value === 'number')
            result += value
        }
      })
    }

    res = await api.notification.getUnreadDm()
    if (res?.code === 0 && res.data) {
      Object.assign(unReadDm, res.data)
      if (typeof unReadDm.follow_unread === 'number')
        result += unReadDm.follow_unread
    }
  }
  catch (error) {
    console.error(error)
  }
  finally {
    unReadMessageCount.value = result
  }
}

function handleNotificationsItemClick(item: { name: string, url: string, unreadCount: number, icon: string }) {
  if (settings.value.openNotificationsPageAsDrawer)
    emit('openDrawer', item.url)
}

watch(
  () => navItemRef.value?.isOpen ?? false,
  (newVal, oldVal) => {
    // Stop loading new message counts on the message page, because it resets to 0 when the
    // users reads the messages on this page
    if (oldVal === undefined && /https?:\/\/message\.bilibili\.com.*$/.test(stripBiliLangPrefix()))
      return

    if (newVal === oldVal)
      return

    if (!newVal)
      void getUnreadMessageCount()
  },
  { immediate: true },
)

onMounted(() => {
  pollTimer = setInterval(() => {
    void getUnreadMessageCount()
  }, updateInterval)
})

onUnmounted(() => {
  if (pollTimer)
    clearInterval(pollTimer)
})
</script>

<template>
  <TopBarNavItem
    ref="navItemRef"
    popup-key="notifications"
    :badge-count="unReadMessageCount"
  >
    <ALink
      :href="settings.openNotificationsPageAsDrawer ? '#' : 'https://message.bilibili.com'"
      :title="$t('topbar.notifications')"
      type="topBar"
      :custom-click-event="settings.openNotificationsPageAsDrawer"
      @click="emit('openDrawer')"
    >
      <div i-tabler:bell />
    </ALink>

    <template #popover>
      <NotificationsPop
        :un-read-message="unReadMessage"
        :un-read-dm="unReadDm"
        @item-click="handleNotificationsItemClick"
      />
    </template>
  </TopBarNavItem>
</template>
