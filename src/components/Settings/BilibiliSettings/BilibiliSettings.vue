<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

import { settings } from '~/logic'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'

const { t } = useI18n()

const biliSiteOptions = computed(() => {
  return [
    {
      label: t('settings.bili_site_opt.cn'),
      value: 'CN',
    },
    {
      label: t('settings.bili_site_opt.overseas'),
      value: 'OVERSEAS',
    },
  ]
})
</script>

<template>
  <div>
    <SettingsItemGroup :title="$t('settings.site_settings')">
      <SettingsItemGroup>
        <SettingsItem :title="$t('settings.bili_site')" :desc="$t('settings.bili_site_desc')">
          <Select v-model="settings.biliSite" :options="biliSiteOptions" w="full" />
        </SettingsItem>
      </SettingsItemGroup>
    </SettingsItemGroup>

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

    <SettingsItemGroup :title="$t('settings.comment_settings')">
      <SettingsItemGroup>
        <SettingsItem :title="$t('settings.show_comment_ip_location')" :desc="$t('settings.show_comment_ip_location_desc')">
          <Radio v-model="settings.showCommentIpLocation" />
        </SettingsItem>
      </SettingsItemGroup>
    </SettingsItemGroup>
  </div>
</template>
