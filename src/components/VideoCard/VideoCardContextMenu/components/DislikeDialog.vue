<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { onKeyStroke } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import type { Video } from '~/components/VideoCard/types'
import { useToast } from '~/composables/useToast'
import { accessKey } from '~/logic'
import { Type as ThreePointV2Type } from '~/models/video/appForYou'
import api from '~/utils/api'
import { getTvSign, TVAppKey } from '~/utils/authProvider'

const props = defineProps<{
  modelValue: boolean
  video: Video
}>()

const emit = defineEmits<{
  (event: 'removed', selectedOpt: { dislikeReasonId: number }): void
  (event: 'close'): void
}>()

const showDislikeDialog = defineModel<boolean>()

const toast = useToast()
const { t } = useI18n()

const selectedDislikeReason = ref<number>(1)

function closeDislikeDialog() {
  showDislikeDialog.value = false
  emit('close')
}

/** 作为`DialogBox`的`onConfirm`：返回`false`表示失败，对话框保持打开 */
async function handleAppDislike(): Promise<false | undefined> {
  if (!accessKey.value) {
    toast.warning(t('auth.auth_access_key_first'))
    return false
  }

  const params = {
    access_key: accessKey.value,
    goto: props.video?.goto,
    id: props.video?.id,
    // https://github.com/magicdawn/bilibili-app-recommend/blob/cb51f75f415f48235ce048537f2013122c16b56b/src/components/VideoCard/card.service.ts#L115
    idx: (Date.now() / 1000).toFixed(0),
    reason_id: selectedDislikeReason.value,
    build: 74800100,
    device: 'pad',
    mobi_app: 'iphone',
    appkey: TVAppKey.appkey,
  }

  const res = await api.video.dislikeVideo({
    ...params,
    sign: getTvSign(params),
  })
  if (res.code !== 0) {
    toast.error(res.message)
    return false
  }
  emit('removed', { dislikeReasonId: selectedDislikeReason.value })
}

onKeyStroke((e: KeyboardEvent) => {
  if (showDislikeDialog.value) {
    const dislikeReasons = props.video?.threePointV2?.find(option => option.type === ThreePointV2Type.Dislike)?.reasons || []

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      dislikeReasons.forEach((reason) => {
        if (dislikeReasons[Number(e.key) - 1] && reason.id === dislikeReasons[Number(e.key) - 1].id)
          selectedDislikeReason.value = reason.id
      })
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const currentIndex = dislikeReasons.findIndex(reason => selectedDislikeReason.value === reason.id)
      if (currentIndex > 0)
        selectedDislikeReason.value = dislikeReasons[currentIndex - 1].id
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const currentIndex = dislikeReasons.findIndex(reason => selectedDislikeReason.value === reason.id)
      if (currentIndex < dislikeReasons.length - 1)
        selectedDislikeReason.value = dislikeReasons[currentIndex + 1].id
    }
  }
})
</script>

<template>
  <DialogBox
    v-if="showDislikeDialog"
    open
    :title="$t('home.tell_us_why')"
    width="420px"
    @closed="closeDislikeDialog"
    @confirm="handleAppDislike"
  >
    <ul flex="~ col gap-2">
      <li
        v-for="(reason, index) in video?.threePointV2?.find(option => option.type === ThreePointV2Type.Dislike)?.reasons"
        :key="reason.id"
        :class="{ 'activated-dislike-reason': selectedDislikeReason === reason.id }"
        p="x-6 y-4" rounded="$bew-radius" cursor-pointer bg="$bew-fill-1 hover:$bew-fill-2"
        flex="~ gap-2 items-center justify-between"
        @click="selectedDislikeReason = reason.id"
      >
        <div flex="~ gap-2">
          <div
            bg="$bew-theme-color" color-white w-20px h-20px rounded-10
            flex="~ justify-center items-center"
          >
            {{ index + 1 }}
          </div>
          {{ reason.name }}
        </div>
        <Icon
          v-if="selectedDislikeReason === reason.id" icon="line-md:confirm"
          w-18px h-18px
        />
      </li>
    </ul>
    <p text="$bew-text-3 sm" mt-4 v-html="$t('home.not_interested_desc')" />
  </DialogBox>
</template>

<style scoped>
.activated-dislike-reason {
  --uno: "bg-$bew-theme-color-20 color-$bew-theme-color";
}
</style>
