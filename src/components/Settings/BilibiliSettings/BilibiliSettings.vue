<script lang="ts" setup>
import { settings } from '~/logic'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'
</script>

<template>
  <div>
    <SettingsItemGroup :title="$t('settings.content_block_settings')">
      <SettingsItemGroup>
        <SettingsItem :title="$t('settings.block_ads')">
          <Radio v-model="settings.blockAds" />
        </SettingsItem>
        <SettingsItem :title="$t('settings.block_top_search_page_ads')" :desc="$t('settings.block_top_search_page_ads_desc')">
          <Radio v-model="settings.blockTopSearchPageAds" />
        </SettingsItem>
        <SettingsItem :title="$t('settings.block_vip_danmuku_style')">
          <Radio v-model="settings.blockVIPDanmukuStyle" />
        </SettingsItem>
      </SettingsItemGroup>
    </SettingsItemGroup>

    <SettingsItemGroup :title="$t('settings.url_trim_settings')">
      <SettingsItemGroup>
        <SettingsItem :title="$t('settings.clean_url_argument')">
          <Radio v-model="settings.cleanUrlArgument" />
        </SettingsItem>
        <SettingsItem :title="$t('settings.bv_to_av')">
          <Radio v-model="settings.bvToAv" />
        </SettingsItem>
      </SettingsItemGroup>
    </SettingsItemGroup>

    <SettingsItemGroup :title="$t('settings.ux_enhancement_features')">
      <SettingsItemGroup>
        <SettingsItem :title="$t('settings.one_click_block')">
          <Radio v-model="settings.oneClickBlock" />
        </SettingsItem>
      </SettingsItemGroup>
    </SettingsItemGroup>
  </div>
</template>
