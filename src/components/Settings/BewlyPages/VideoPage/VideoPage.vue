<script lang="ts" setup>
import { settings } from '~/logic'
import { isVideoOrBangumiPage } from '~/utils/main'

import SettingsItem from '../../components/SettingsItem.vue'
import SettingsItemGroup from '../../components/SettingsItemGroup.vue'

watch(() => settings.value.legacyPlayerLoadingScreen, () => {
  if (isVideoOrBangumiPage())
    location.reload()
})
</script>

<template>
  <div>
    <SettingsItemGroup :title="$t('settings.group_video_page')">
      <!-- 控制视频页背景的开关 -->
      <SettingsItem :title="$t('settings.show_video_page_background')" :desc="$t('settings.show_video_page_background_desc')">
        <Radio v-model="settings.showVideoPageBackground" />
      </SettingsItem>

      <!-- 控制视频页弹幕列表样式的开关 -->
      <SettingsItem :title="$t('settings.video_page_danmaku_style')" :desc="$t('settings.video_page_danmaku_style_desc')">
        <div w-full flex rounded="$bew-radius" bg="$bew-fill-1" p-1>
          <div
            flex-1 py-1 cursor-pointer text-center rounded="$bew-radius"
            :style="{
              background: settings.videoPageDanmakuStyle === 'auto' ? 'var(--bew-theme-color)' : '',
              color: settings.videoPageDanmakuStyle === 'auto' ? 'white' : '',
            }"
            @click="settings.videoPageDanmakuStyle = 'auto'"
          >
            {{ $t('settings.style_auto_follow_bg') }}
          </div>
          <div
            flex-1 py-1 cursor-pointer text-center rounded="$bew-radius"
            :style="{
              background: settings.videoPageDanmakuStyle === 'on' ? 'var(--bew-theme-color)' : '',
              color: settings.videoPageDanmakuStyle === 'on' ? 'white' : '',
            }"
            @click="settings.videoPageDanmakuStyle = 'on'"
          >
            {{ $t('settings.style_force_enable') }}
          </div>
          <div
            flex-1 py-1 cursor-pointer text-center rounded="$bew-radius"
            :style="{
              background: settings.videoPageDanmakuStyle === 'off' ? 'var(--bew-theme-color)' : '',
              color: settings.videoPageDanmakuStyle === 'off' ? 'white' : '',
            }"
            @click="settings.videoPageDanmakuStyle = 'off'"
          >
            {{ $t('settings.style_force_disable') }}
          </div>
        </div>
      </SettingsItem>

      <!-- 控制视频页视频合集列表样式的开关 -->
      <SettingsItem :title="$t('settings.video_page_video_pod_style')" :desc="$t('settings.video_page_video_pod_style_desc')">
        <div w-full flex rounded="$bew-radius" bg="$bew-fill-1" p-1>
          <div
            flex-1 py-1 cursor-pointer text-center rounded="$bew-radius"
            :style="{
              background: settings.videoPageVideoPodStyle === 'auto' ? 'var(--bew-theme-color)' : '',
              color: settings.videoPageVideoPodStyle === 'auto' ? 'white' : '',
            }"
            @click="settings.videoPageVideoPodStyle = 'auto'"
          >
            {{ $t('settings.style_auto_follow_bg') }}
          </div>
          <div
            flex-1 py-1 cursor-pointer text-center rounded="$bew-radius"
            :style="{
              background: settings.videoPageVideoPodStyle === 'on' ? 'var(--bew-theme-color)' : '',
              color: settings.videoPageVideoPodStyle === 'on' ? 'white' : '',
            }"
            @click="settings.videoPageVideoPodStyle = 'on'"
          >
            {{ $t('settings.style_force_enable') }}
          </div>
          <div
            flex-1 py-1 cursor-pointer text-center rounded="$bew-radius"
            :style="{
              background: settings.videoPageVideoPodStyle === 'off' ? 'var(--bew-theme-color)' : '',
              color: settings.videoPageVideoPodStyle === 'off' ? 'white' : '',
            }"
            @click="settings.videoPageVideoPodStyle = 'off'"
          >
            {{ $t('settings.style_force_disable') }}
          </div>
        </div>
      </SettingsItem>

      <SettingsItem :title="$t('settings.legacy_player_loading_screen')">
        <Radio v-model="settings.legacyPlayerLoadingScreen" />
      </SettingsItem>
    </SettingsItemGroup>
  </div>
</template>

<style scoped lang="scss">
</style>
