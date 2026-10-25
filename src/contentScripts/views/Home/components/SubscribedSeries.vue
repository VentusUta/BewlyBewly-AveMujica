<script setup lang="ts">
import { useBewlyApp } from '~/composables/useAppProvider'
import type { InfiniteLoadResult } from '~/composables/useInfiniteList'
import { useInfiniteList } from '~/composables/useInfiniteList'
import type { GridLayoutType } from '~/logic'
import type { DataItem as MomentItem, MomentResult } from '~/models/moment/moment'
import api from '~/utils/api'

// https://github.com/starknt/BewlyBewly/blob/fad999c2e482095dc3840bb291af53d15ff44130/src/contentScripts/views/Home/components/ForYou.vue#L16
interface VideoElement {
  uniqueId: string
  item?: MomentItem
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
const offset = ref<string>('')
const updateBaseline = ref<string>('')
const noMoreContent = ref<boolean>(false)
const { handlePageRefresh } = useBewlyApp()

const sentinel = useTemplateRef<HTMLElement>('sentinel')
const { loading: isLoading, error: loadError, restart } = useInfiniteList({
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

function initData() {
  offset.value = ''
  updateBaseline.value = ''
  videoList.value.length = 0
  noMoreContent.value = false
  restart()
}

function initPageAction() {
  handlePageRefresh.value = () => {
    initData()
  }
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
    const response: MomentResult = await api.moment.getMoments({
      type: 'pgc',
      offset: Number(offset.value),
      update_baseline: updateBaseline.value,
    })
    if (signal.aborted)
      return 'more'

    if (response.code === -101) {
      needToLoginFirst.value = true
      return 'done'
    }
    // 没有可显示的动态时接口返回 4101132，B站自己的动态页也把它当作“没有内容”
    if (response.code === 4101132) {
      noMoreContent.value = true
      return 'done'
    }
    if (response.code !== 0)
      throw new Error(`getMoments failed with code ${response.code}`)

    offset.value = response.data.offset
    updateBaseline.value = response.data.update_baseline

    const resData = [] as MomentItem[]

    response.data.items.forEach((item: MomentItem) => {
      resData.push(item)
    })

    // when videoList has length property, it means it is the first time to load
    if (!videoList.value.length) {
      videoList.value = resData.map(item => ({ uniqueId: `${item.id_str}`, item }))
    }
    else {
      resData.forEach((item) => {
        videoList.value[lastVideoListLength++] = {
          uniqueId: `${item.id_str}`,
          item,
        }
      })
    }

    if (!response.data.has_more || offset.value === '0') {
      noMoreContent.value = true
      return 'done'
    }
    return resData.length > 0 ? 'more' : 'empty'
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
    <Empty v-if="videoList.length === 0 && (noMoreContent || loadError) && !needToLoginFirst" mt-6 :description="$t('common.no_more_content')">
      <Button type="primary" @click="initData()">
        {{ $t('common.operation.refresh') }}
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
        type="bangumi"
        :video="video.item ? {
          id: video.item.modules.module_author.mid,
          title: `${video.item.modules.module_dynamic.major.pgc?.title}`,
          cover: `${video.item.modules.module_dynamic.major.pgc?.cover}`,
          author: {
            name: video.item.modules.module_author.name,
            authorUrl: video.item.modules.module_author.jump_url,
            authorFace: video.item.modules.module_author.face,
            mid: video.item.modules.module_author.mid,
          },
          viewStr: video.item.modules.module_dynamic.major.pgc?.stat.play,
          danmakuStr: video.item.modules.module_dynamic.major.pgc?.stat.danmaku,
          capsuleText: video.item.modules.module_author.pub_time,
          epid: video.item.modules.module_dynamic.major.pgc?.epid,
        } : undefined"
        :show-watcher-later="false"
        :horizontal="gridLayout !== 'adaptive'"
      />
    </div>
    <div ref="sentinel" aria-hidden="true" h-1px />

    <!-- no more content -->
    <Empty v-if="noMoreContent && videoList.length > 0" class="pb-4" :description="$t('common.no_more_content')" />
  </div>
</template>

<style lang="scss" scoped>
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
