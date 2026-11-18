<script setup lang="ts">
import { useSessionStore } from '~/stores/sessionStore'
import api from '~/utils/api'

import { updateInterval } from '../notify'
import MomentsPop from './MomentsPop.vue'
import TopBarNavItem from './TopBarNavItem.vue'

const session = useSessionStore()
const momentsPop = ref<InstanceType<typeof MomentsPop> | null>(null)
const newMomentsCount = ref<number>(0)
let pollTimer: ReturnType<typeof setInterval> | undefined

async function getTopBarNewMomentsCount() {
  if (session.status === 'loggedOut')
    return

  let result = 0

  try {
    const res = await api.moment.getTopBarNewMomentsCount()
    if (res?.code === 0) {
      if (typeof res.data?.update_num === 'number')
        result = res.data.update_num
    }
  }
  catch (error) {
    console.error(error)
  }
  finally {
    newMomentsCount.value = result
  }
}

function handleOpen() {
  momentsPop.value?.refreshMomentsIfNeeded(newMomentsCount.value > 0)
}

function handleClose() {
  void getTopBarNewMomentsCount()
}

onMounted(() => {
  void getTopBarNewMomentsCount()
  pollTimer = setInterval(() => {
    void getTopBarNewMomentsCount()
  }, updateInterval)
})

onUnmounted(() => {
  if (pollTimer)
    clearInterval(pollTimer)
})
</script>

<template>
  <TopBarNavItem
    popup-key="moments"
    :badge-count="newMomentsCount"
    keep="mounted"
    @open="handleOpen"
    @close="handleClose"
  >
    <ALink
      href="https://t.bilibili.com"
      :title="$t('topbar.moments')"
      type="topBar"
    >
      <div i-tabler:windmill />
    </ALink>

    <template #popover>
      <MomentsPop ref="momentsPop" />
    </template>
  </TopBarNavItem>
</template>
