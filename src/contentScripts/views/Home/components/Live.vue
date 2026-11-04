<script setup lang="ts">
import { useBewlyApp } from '~/composables/useAppProvider'
import type { InfiniteLoadResult } from '~/composables/useInfiniteList'
import { useInfiniteList } from '~/composables/useInfiniteList'
import type { GridLayoutType } from '~/logic'
import type { FollowingLiveResult, List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import api from '~/utils/api'

// https://github.com/starknt/BewlyBewly/blob/fad999c2e482095dc3840bb291af53d15ff44130/src/contentScripts/views/Home/components/ForYou.vue#L16
interface VideoElement {
  uniqueId: string
  item?: FollowingLiveItem
}

const props = defineProps<{
  gridLayout: GridLayoutType
}>()

const emit = defineEmits<{
  (e: 'beforeLoading'): void
  (e: 'afterLoading'): void
}>()

const gridClass = computed((): string => {
  if (props.gridLayout === 'adaptive')
    return 'grid-adaptive'
  if (props.gridLayout === 'twoColumns')
    return 'grid-two-columns'
  return 'grid-one-column'
})

const videoList = ref<VideoElement[]>([])
const needToLoginFirst = ref<boolean>(false)
const page = ref<number>(1)
const noMoreContent = ref<boolean>(false)
const { handlePageRefresh } = useBewlyApp()

const sentinel = useTemplateRef<HTMLElement>('sentinel')
const { loading: isLoading, restart } = useInfiniteList({
  sentinel,
  canLoadMore: () => !needToLoginFirst.value,
  load: getFollowedUsersVideos,
})
watch(isLoading, (loading) => {
  if (loading)
    emit('beforeLoading')
  else
    emit('afterLoading')
})

onMounted(() => {
  initPageAction()
})

onActivated(() => {
  initPageAction()
})

function initPageAction() {
  handlePageRefresh.value = () => {
    initData()
  }
}

function initData() {
  page.value = 1
  videoList.value.length = 0
  noMoreContent.value = false
  restart()
}

async function getFollowedUsersVideos(signal: AbortSignal): Promise<InfiniteLoadResult> {
  let i = 0
  // https://github.com/starknt/BewlyBewly/blob/fad999c2e482095dc3840bb291af53d15ff44130/src/contentScripts/views/Home/components/ForYou.vue#L208
  const pendingVideos: VideoElement[] = Array.from({ length: 30 }, () => ({
    uniqueId: `unique-id-${(videoList.value.length || 0) + i++})}`,
  } satisfies VideoElement))
  let lastVideoListLength = videoList.value.length
  videoList.value.push(...pendingVideos)

  try {
    const response: FollowingLiveResult = await api.live.getFollowingLiveList({
      page: page.value,
      page_size: 9,
    })
    if (signal.aborted)
      return 'more'

    if (response.code === -101) {
      needToLoginFirst.value = true
      return 'done'
    }
    if (response.code !== 0)
      throw new Error(`getFollowingLiveList failed with code ${response.code}`)

    page.value++

    const resData = [] as FollowingLiveItem[]

    response.data.list.forEach((item: FollowingLiveItem) => {
      resData.push(item)
    })

    // when videoList has length property, it means it is the first time to load
    if (!videoList.value.length) {
      videoList.value = resData.map(item => ({ uniqueId: `${item.roomid}`, item }))
    }
    else {
      resData.forEach((item) => {
        videoList.value[lastVideoListLength++] = {
          uniqueId: `${item.roomid}`,
          item,
        }
      })
    }

    if (resData.length < 9) {
      noMoreContent.value = true
      return 'done'
    }
    return 'more'
  }
  finally {
    // 被中止时列表已经属于刷新后的加载，不能动
    if (!signal.aborted)
      videoList.value = videoList.value.filter(video => video.item)
  }
}

function jumpToLoginPage() {
  location.href = 'https://passport.bilibili.com/login'
}

defineExpose({ initData })
</script>

<template>
  <div>
    <Empty v-if="needToLoginFirst" mt-6 :description="$t('common.please_log_in_first')">
      <Button type="primary" @click="jumpToLoginPage()">
        {{ $t('common.login') }}
      </Button>
    </Empty>
    <div
      v-else
      m="b-0 t-0" relative w-full h-full
      :class="gridClass"
    >
      <VideoCard
        v-for="video in videoList"
        :key="video.uniqueId"
        :skeleton="!video.item"
        :video="video.item ? {
          // id: Number(video.item.modules.module_dynamic.major.archive?.aid),
          title: `${video.item.title}`,
          cover: `${video.item.room_cover}`,
          author: {
            name: video.item.uname,
            authorFace: video.item.face,
            mid: video.item.uid,
          },
          viewStr: video.item.text_small,
          tag: video.item.area_name_v2,
          roomid: video.item.roomid,
          liveStatus: video.item.live_status,
        } : undefined"
        type="live"
        :show-watcher-later="false"
        :horizontal="gridLayout !== 'adaptive'"
      />
    </div>
    <div ref="sentinel" aria-hidden="true" h-1px />

    <!-- no more content -->
    <Empty v-if="noMoreContent && !needToLoginFirst" class="pb-4" :description="$t('common.no_more_content')" />
  </div>
</template>

<style scoped>
.grid-adaptive {
  --uno: "grid 2xl:cols-5 xl:cols-4 lg:cols-3 md:cols-2 sm:cols-1 cols-1 gap-5";
}

.grid-two-columns {
  --uno: "grid cols-1 xl:cols-2 gap-4";
}

.grid-one-column {
  --uno: "grid cols-1 gap-4";
}
</style>
