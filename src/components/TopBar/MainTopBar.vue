<script setup lang="ts">
import { useBewlyApp } from '~/composables/useAppProvider'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { useSessionStore } from '~/stores/sessionStore'
import { useWallpaperStore } from '~/stores/wallpaperStore'
import { isHomePage, isInIframe, stripBiliLangPrefix } from '~/utils/main'

import BaseTopBar from './BaseTopBar.vue'
import BewlyOrBiliPageSwitcher from './components/BewlyOrBiliPageSwitcher.vue'
import ChannelsPop from './components/ChannelsPop.vue'
import FavoritesPop from './components/FavoritesPop.vue'
import HistoryPop from './components/HistoryPop.vue'
import TopBarMomentsItem from './components/TopBarMomentsItem.vue'
import TopBarNavItem from './components/TopBarNavItem.vue'
import TopBarNotificationsItem from './components/TopBarNotificationsItem.vue'
import UploadPop from './components/UploadPop.vue'
import WatchLaterPop from './components/WatchLaterPop.vue'

const { activatedPage, reachTop } = useBewlyApp()
const session = useSessionStore()
const wallpaper = useWallpaperStore()
const wallpaperUrl = computed(() => wallpaper.resolve(settings.value.wallpaper))
const searchPageWallpaperUrl = computed(() => wallpaper.resolve(settings.value.searchPageWallpaper))

const mid = computed(() => session.userID ?? '')
const baseTopBarRef = ref<InstanceType<typeof BaseTopBar> | null>(null)
const favoritesPop = ref<InstanceType<typeof FavoritesPop> | null>(null)

const isSearchPage = computed((): boolean => {
  if (/https?:\/\/search.bilibili.com\/.*$/.test(stripBiliLangPrefix()))
    return true
  return false
})

// 當使用背景時，強制 icon 變白色用於區分背景
const forceWhiteIcon = computed((): boolean => {
  if (
    // 首頁使用原生 bilibili 首頁時由於原版有 banner，所以強制 icon 變白色用於區分背景
    (isHomePage() && settings.value.useOriginalBilibiliHomepage)
    || (isInIframe() && isHomePage())
    // 分區頁面由於上面有背景，所以強制 icon 變白色用於區分背景
    // channel, anime, chinese anime, tv shows, movie, variety shows, mooc but not including video page
    || (
      /https?:\/\/(?:www.)?bilibili.com\/(?:v|anime|guochuang|tv|movie|variety|mooc).*/.test(stripBiliLangPrefix())
      && !/https?:\/\/(?:www.)?bilibili.com\/video.*/.test(stripBiliLangPrefix())
    )
    // user space page 空間頁
    || /https?:\/\/space.bilibili\.com\.*/.test(stripBiliLangPrefix())
    // premium page bilibili 大會員頁
    || /https?:\/\/account\.bilibili\.com\/big.*$/.test(stripBiliLangPrefix())
    || /https?:\/\/(?:www\.)?bilibili\.com\/c\/(?!popular).*/.test(stripBiliLangPrefix())
  ) {
    return true
  }
  if (!isHomePage()) {
    return false
  }
  if (activatedPage.value === AppPage.Search) {
    if (settings.value.individuallySetSearchPageWallpaper) {
      if (searchPageWallpaperUrl.value)
        return true
      return false
    }
    return !!wallpaperUrl.value
  }
  else {
    if (wallpaperUrl.value) {
      return true
    }
    else {
      if (settings.value.useSearchPageModeOnHomePage) {
        if (settings.value.individuallySetSearchPageWallpaper && !!searchPageWallpaperUrl.value)
          return true
        else if (wallpaperUrl.value)
          return true
      }
    }
    return false
  }
})

const showSearchBar = computed((): boolean => {
  if (isHomePage()) {
    if (settings.value.useOriginalBilibiliHomepage)
      return true
    if (activatedPage.value === AppPage.Search)
      return false
    if (settings.value.useSearchPageModeOnHomePage && activatedPage.value === AppPage.Home && reachTop.value)
      return false
  }
  else {
    if (isSearchPage.value)
      return false
  }
  return true
})

const isTopBarFixed = computed((): boolean => {
  if (
    isHomePage()
    // video page
    || /https?:\/\/(?:www.)?bilibili.com\/(?:video|list)\/.*/.test(stripBiliLangPrefix())
    // anime playback & movie page
    || /https?:\/\/(?:www.)?bilibili.com\/bangumi\/play\/.*/.test(stripBiliLangPrefix())
    // moment page
    || /https?:\/\/t.bilibili.com.*/.test(stripBiliLangPrefix())
    // channel, anime, chinese anime, tv shows, movie, variety shows, mooc
    || /https?:\/\/(?:www.)?bilibili.com\/(?:v|anime|guochuang|tv|movie|variety|mooc).*/.test(stripBiliLangPrefix())
    // articles page
    || /https?:\/\/(?:www.)?bilibili.com\/read\/home.*/.test(stripBiliLangPrefix())
    // premium page bilibili 大會員頁
    || /https?:\/\/account\.bilibili\.com\/big.*$/.test(stripBiliLangPrefix())
  ) {
    return true
  }
  return false
})

const showTopBar = computed((): boolean => {
  if (
    // Creative center page
    /https?:\/\/member.bilibili.com\/platform.*/.test(stripBiliLangPrefix())
    // https://github.com/BewlyBewly/BewlyBewly/issues/1276
    || /https?:\/\/(?:www\.)?bilibili\.com\/read\/(?:preview|pcpreview).*/.test(stripBiliLangPrefix())
  ) {
    return false
  }
  if (settings.value.showTopBar)
    return true
  return false
})

function handleFavoritesOpen() {
  nextTick(() => {
    favoritesPop.value?.refreshFavoriteResources()
  })
}

defineExpose({
  toggleTopBarVisible: (visible: boolean) => baseTopBarRef.value?.toggleTopBarVisible(visible),
  handleScroll: () => baseTopBarRef.value?.handleScroll(),
})
</script>

<template>
  <BaseTopBar
    ref="baseTopBarRef"
    :show-top-bar="showTopBar"
    :is-fixed="isTopBarFixed"
    :force-white-icon="forceWhiteIcon"
    :show-search-bar="showSearchBar"
    logo-href="//www.bilibili.com"
  >
    <template #logo-popover>
      <ChannelsPop
        class="bew-popover"
        pos="!left-0 !top-50px"
        transform="!translate-x-0"
      />
    </template>

    <template #left-extra>
      <BewlyOrBiliPageSwitcher v-if="settings.showBewlyOrBiliPageSwitcher" z-1 />
    </template>

    <template #right-items="{ openNotificationsDrawer }">
      <TopBarMomentsItem />

      <TopBarNavItem
        popup-key="favorites"
        keep="opened"
        @open="handleFavoritesOpen"
      >
        <ALink
          :href="`https://space.bilibili.com/${mid}/favlist`"
          :title="$t('topbar.favorites')"
          type="topBar"
        >
          <div i-mingcute:star-line />
        </ALink>

        <template #popover>
          <FavoritesPop ref="favoritesPop" />
        </template>
      </TopBarNavItem>

      <TopBarNavItem popup-key="history">
        <ALink
          href="https://www.bilibili.com/history"
          :title="$t('topbar.history')"
          type="topBar"
        >
          <div i-mingcute:time-line />
        </ALink>

        <template #popover>
          <HistoryPop />
        </template>
      </TopBarNavItem>

      <TopBarNavItem popup-key="watchLater">
        <ALink
          href="https://www.bilibili.com/watchlater/list"
          :title="$t('topbar.watch_later')"
          type="topBar"
        >
          <div i-mingcute:carplay-line />
        </ALink>

        <template #popover>
          <WatchLaterPop />
        </template>
      </TopBarNavItem>

      <TopBarNavItem>
        <a
          href="https://member.bilibili.com/platform/home"
          target="_blank"
          :title="$t('topbar.creative_center')"
        >
          <div i-mingcute:bulb-line />
        </a>
      </TopBarNavItem>

      <div
        w-2px h-16px bg="$bew-border-color" mx-1
        rounded-4px
      />

      <TopBarNavItem popup-key="upload">
        <a
          class="accent"
          style="backdrop-filter: var(--bew-filter-glass-1);"
          href="https://member.bilibili.com/platform/upload/video/frame"
          target="_blank"
          :title="$t('topbar.upload')"
        >
          <div i-mingcute:upload-line flex-shrink-0 />
        </a>

        <template #popover>
          <UploadPop />
        </template>
      </TopBarNavItem>

      <TopBarNotificationsItem @open-drawer="openNotificationsDrawer" />
    </template>
  </BaseTopBar>
</template>
