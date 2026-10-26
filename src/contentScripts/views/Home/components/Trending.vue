<script setup lang="ts">
import { useBewlyApp } from '~/composables/useAppProvider'
import type { InfiniteLoadResult } from '~/composables/useInfiniteList'
import { useInfiniteList } from '~/composables/useInfiniteList'
import { getBiliTranslationParams } from '~/contentScripts/biliTranslation'
import type { GridLayoutType } from '~/logic'
import type { List as VideoItem, TrendingResult } from '~/models/video/trending'
import api from '~/utils/api'
import { getTranslatedTitle } from '~/utils/biliTranslation'

// https://github.com/starknt/BewlyBewly/blob/fad999c2e482095dc3840bb291af53d15ff44130/src/contentScripts/views/Home/components/ForYou.vue#L16
interface VideoElement {
  uniqueId: string
  item?: VideoItem
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
const pn = ref<number>(1)
const noMoreContent = ref<boolean>(false)
const { handlePageRefresh } = useBewlyApp()

const sentinel = useTemplateRef<HTMLElement>('sentinel')
const { loading: isLoading, restart } = useInfiniteList({ sentinel, load: getTrendingVideos })
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
  noMoreContent.value = false
  videoList.value.length = 0
  pn.value = 1
  restart()
}

function initPageAction() {
  handlePageRefresh.value = () => {
    initData()
  }
}

async function getTrendingVideos(signal: AbortSignal): Promise<InfiniteLoadResult> {
  let i = 0
  // https://github.com/starknt/BewlyBewly/blob/fad999c2e482095dc3840bb291af53d15ff44130/src/contentScripts/views/Home/components/ForYou.vue#L208
  const pendingVideos: VideoElement[] = Array.from({ length: 30 }, () => ({
    uniqueId: `unique-id-${(videoList.value.length || 0) + i++})}`,
  } satisfies VideoElement))
  let lastVideoListLength = videoList.value.length
  videoList.value.push(...pendingVideos)

  try {
    const response: TrendingResult = await api.video.getPopularVideos({
      pn: pn.value,
      ps: 30,
      ...getBiliTranslationParams(),
    })
    if (signal.aborted)
      return 'more'
    if (response.code !== 0)
      throw new Error(`getPopularVideos failed with code ${response.code}`)

    pn.value++
    noMoreContent.value = response.data.no_more

    const resData = [] as VideoItem[]

    response.data.list.forEach((item: VideoItem) => {
      resData.push(item)
    })

    // when videoList has length property, it means it is the first time to load
    if (!videoList.value.length) {
      videoList.value = resData.map(item => ({ uniqueId: `${item.aid}`, item }))
    }
    else {
      resData.forEach((item) => {
        videoList.value[lastVideoListLength++] = {
          uniqueId: `${item.aid}`,
          item,
        }
      })
    }

    if (noMoreContent.value)
      return 'done'
    return resData.length > 0 ? 'more' : 'empty'
  }
  finally {
    // 被中止时列表已经属于刷新后的加载，不能动
    if (!signal.aborted)
      videoList.value = videoList.value.filter(video => video.item)
  }
}

defineExpose({ initData })
</script>

<template>
  <div>
    <div
      m="b-0 t-0" relative w-full h-full
      :class="gridClass"
    >
      <VideoCard
        v-for="video in videoList"
        :key="video.uniqueId"
        :skeleton="!video.item"
        :video="video.item ? {
          id: Number(video.item.aid),
          duration: video.item.duration,
          title: getTranslatedTitle(video.item),
          desc: video.item.desc,
          cover: video.item.pic,
          author: {
            name: video.item.owner.name,
            authorFace: video.item.owner.face,
            mid: video.item.owner.mid,
          },
          view: video.item.stat.view,
          danmaku: video.item.stat.danmaku,
          publishedTimestamp: video.item.pubdate,
          bvid: video.item.bvid,
          tag: video.item.rcmd_reason.content,
          cid: video.item.cid,
        } : undefined"
        show-preview
        :horizontal="gridLayout !== 'adaptive'"
      />
    </div>
    <div ref="sentinel" aria-hidden="true" h-1px />
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
