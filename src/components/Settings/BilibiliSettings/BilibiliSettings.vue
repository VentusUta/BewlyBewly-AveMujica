<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

import { settings } from '~/logic'
import { BILI_TRANSLATION_LANGS } from '~/utils/biliTranslation'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'

const { t } = useI18n()

const biliTranslationOptions = computed(() => {
  return [
    {
      label: t('settings.bili_translation_opt.original'),
      value: 'original',
    },
    ...BILI_TRANSLATION_LANGS.map(lang => ({
      label: t(`settings.bili_translation_opt.${lang.replace('-', '_').toLowerCase()}`),
      value: lang,
    })),
  ]
})
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

    <SettingsItemGroup :title="$t('settings.bilibili_api_based_settings')">
      <SettingsItemGroup>
        <SettingsItem :title="$t('settings.show_comment_ip_location')">
          <Radio v-model="settings.showCommentIpLocation" />
        </SettingsItem>
        <SettingsItem :title="$t('settings.bili_translation')">
          <Select
            v-model="settings.biliTranslation"
            :options="biliTranslationOptions"
            w="full"
          />
        </SettingsItem>
      </SettingsItemGroup>
    </SettingsItemGroup>
  </div>
</template>
