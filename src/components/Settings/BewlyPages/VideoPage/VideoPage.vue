<script lang="ts" setup>
import { settings } from '~/logic'
import SettingsItem from '../../components/SettingsItem.vue'
import SettingsItemGroup from '../../components/SettingsItemGroup.vue'
</script>

<template>
  <div>
    <SettingsItemGroup :title="$t('settings.group_video_page')">
      <!-- 控制视频页背景的开关 -->
      <SettingsItem :title="$t('settings.show_video_page_background')">
        <Radio v-model="settings.showVideoPageBackground" />
      </SettingsItem>
    </SettingsItemGroup>
  </div>
</template>

<style scoped lang="scss">
</style>
