<script lang="ts" setup>
import { Icon } from '@iconify/vue'
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
const reasons = computed(() => props.video?.threePointV2?.find(option => option.type === ThreePointV2Type.Dislike)?.reasons ?? [])
const groupName = useId()
const groupRef = useTemplateRef<HTMLFieldSetElement>('group')

function closeDislikeDialog() {
  showDislikeDialog.value = false
  emit('close')
}

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

function handleKeydown(event: KeyboardEvent) {
  const group = groupRef.value
  if (!group || group.closest('[inert]') || event.ctrlKey || event.metaKey || event.altKey)
    return

  const radios = [...group.querySelectorAll('input')]
  const current = radios.findIndex(radio => radio.checked)
  let index: number
  if (/^[1-9]$/.test(event.key))
    index = Number(event.key) - 1
  else if (event.target !== event.currentTarget)
    return
  else if (event.key === 'ArrowDown')
    index = (current + 1) % radios.length
  else if (event.key === 'ArrowUp')
    index = (current <= 0 ? radios.length : current) - 1
  else
    return

  event.preventDefault()
  radios[index]?.focus()
  radios[index]?.click()
}
</script>

<template>
  <DialogBox
    v-if="showDislikeDialog"
    open
    :title="$t('home.tell_us_why')"
    width="420px"
    @closed="closeDislikeDialog"
    @confirm="handleAppDislike"
    @keydown="handleKeydown"
  >
    <fieldset ref="group" class="reasons">
      <legend class="reasons__legend">
        {{ $t('home.tell_us_why') }}
      </legend>
      <label
        v-for="(reason, index) in reasons"
        :key="reason.id"
        class="reason"
        :class="{ 'activated-dislike-reason': selectedDislikeReason === reason.id }"
        p="x-6 y-4" rounded="$bew-radius" cursor-pointer bg="$bew-fill-1 hover:$bew-fill-2"
        flex="~ gap-2 items-center justify-between"
      >
        <input
          v-model="selectedDislikeReason"
          class="reason__radio"
          type="radio"
          :name="groupName"
          :value="reason.id"
          :autofocus="selectedDislikeReason === reason.id"
        >
        <span flex="~ gap-2">
          <span
            bg="$bew-theme-color" color-white w-20px h-20px rounded-10
            flex="~ justify-center items-center"
          >
            {{ index + 1 }}
          </span>
          {{ reason.name }}
        </span>
        <Icon
          v-if="selectedDislikeReason === reason.id" icon="line-md:confirm"
          w-18px h-18px
        />
      </label>
    </fieldset>
    <p text="$bew-text-3 sm" mt-4 v-html="$t('home.not_interested_desc')" />
  </DialogBox>
</template>

<style scoped>
.reasons {
  --uno: "flex flex-col gap-2 m-0 p-0 border-0 min-w-0";
}

.reasons__legend,
.reason__radio {
  --uno: "sr-only";
}

.reason {
  position: relative;
}

.reason:has(:focus-visible) {
  outline-style: auto;
  outline-offset: 1px;
}

.activated-dislike-reason {
  --uno: "bg-$bew-theme-color-20 color-$bew-theme-color";
}
</style>
