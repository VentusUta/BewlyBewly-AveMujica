<script setup lang="ts">
import { useEventListener, useThrottleFn, useToggle } from '@vueuse/core'
import type { Ref } from 'vue'

import type { BewlyAppProvider } from '~/composables/useAppProvider'
import { useDark } from '~/composables/useDark'
import { BEWLY_MOUNTED, DRAWER_VIDEO_ENTER_PAGE_FULL, DRAWER_VIDEO_EXIT_PAGE_FULL, IFRAME_PAGE_SWITCH_BEWLY, IFRAME_PAGE_SWITCH_BILI, OVERLAY_SCROLL_BAR_SCROLL } from '~/constants/globalEvents'
import { AppPage } from '~/enums/appEnums'
import { settings } from '~/logic'
import { type DockItem, useMainStore } from '~/stores/mainStore'
import { useSettingsStore } from '~/stores/settingsStore'
import { isHomePage, isInIframe, isNotificationPage, isVideoOrBangumiPage, openLinkToNewTab, queryDomUntilFound, scrollToTop } from '~/utils/main'
import emitter from '~/utils/mitt'

import { setupNecessarySettingsWatchers } from './necessarySettingsWatchers'

const mainStore = useMainStore()
const settingsStore = useSettingsStore()
const { isDark } = useDark()
const [showSettings, toggleSettings] = useToggle(false)

// Get the 'page' query parameter from the URL
function getPageParam(): AppPage | null {
  const urlParams = new URLSearchParams(window.location.search)
  const result = urlParams.get('page') as AppPage | null
  if (result && Object.values(AppPage).includes(result))
    return result
  return null
}

const activatedPage = ref<AppPage>(getPageParam() || (settings.value.dockItemsConfig.find(e => e.visible === true)?.page || AppPage.Home))
const pages = {
  [AppPage.Home]: defineAsyncComponent(() => import('./Home/Home.vue')),
  [AppPage.Search]: defineAsyncComponent(() => import('./Search/Search.vue')),
  [AppPage.Anime]: defineAsyncComponent(() => import('./Anime/Anime.vue')),
  [AppPage.History]: defineAsyncComponent(() => import('./History/History.vue')),
  [AppPage.WatchLater]: defineAsyncComponent(() => import('./WatchLater/WatchLater.vue')),
  [AppPage.Favorites]: defineAsyncComponent(() => import('./Favorites/Favorites.vue')),
  [AppPage.Moments]: defineAsyncComponent(() => import('./Moments/Moments.vue')),
}
const mainAppRef = ref<HTMLElement>() as Ref<HTMLElement>
const scrollbarRef = ref()
const handlePageRefresh = ref<() => void>()
const handleReachBottom = ref<() => void>()
const handleUndoRefresh = ref<() => void>()
const handleForwardRefresh = ref<() => void>()
const showUndoButton = ref<boolean>(false)
const handleThrottledPageRefresh = useThrottleFn(() => handlePageRefresh.value?.(), 500)
const handleThrottledReachBottom = useThrottleFn(() => handleReachBottom.value?.(), 500)
const handleThrottledBackToTop = useThrottleFn(() => handleBackToTop(), 1000)
const handleThrottledPageUnRefresh = useThrottleFn(() => handleUndoRefresh.value?.(), 500)
const handleThrottledPageForwardRefresh = useThrottleFn(() => handleForwardRefresh.value?.(), 500)
const topBarRef = ref()
const reachTop = ref<boolean>(true)

const iframeDrawerURL = ref<string>('')
const showIframeDrawer = ref<boolean>(false)

const iframePageRef = ref()
useEventListener(window, 'message', ({ data }) => {
  switch (data) {
    case IFRAME_PAGE_SWITCH_BEWLY:
      {
        const currentDockItemConfig = settingsStore.getDockItemConfigByPage(activatedPage.value)
        if (currentDockItemConfig)
          currentDockItemConfig.useOriginalBiliPage = false
      }
      break
    case IFRAME_PAGE_SWITCH_BILI:
      {
        const currentDockItemConfig = settingsStore.getDockItemConfigByPage(activatedPage.value)
        if (currentDockItemConfig)
          currentDockItemConfig.useOriginalBiliPage = true
      }
      break
  }
})
const iframePageURL = computed((): string => {
  // If the iframe is not the BiliBili homepage or in iframe, then don't show the iframe page
  if (!isHomePage(window.self.location.href) || isInIframe())
    return ''
  const currentDockItemConfig = settings.value.dockItemsConfig.find(e => e.page === activatedPage.value)
  if (currentDockItemConfig) {
    return currentDockItemConfig.useOriginalBiliPage || !mainStore.getDockItemByPage(activatedPage.value)?.hasBewlyPage ? mainStore.getBiliWebPageURLByPage(activatedPage.value) : ''
  }
  return ''
})
const showBewlyPage = computed((): boolean => {
  if (isInIframe())
    return false

  const dockItem = mainStore.getDockItemByPage(activatedPage.value)
  if (!dockItem?.hasBewlyPage)
    return false

  if (iframePageURL.value)
    return false

  return isHomePage() && !settings.value.useOriginalBilibiliHomepage
})
const showTopBar = computed((): boolean => {
  // When using the open in drawer feature, the iframe inside the page will hide the top bar
  if (isVideoOrBangumiPage() && isInIframe())
    return false

  // when user open the notifications page as a drawer, don't show the top bar
  if (isNotificationPage() && settings.value.openNotificationsPageAsDrawer && isInIframe())
    return false

  // When the user switches to the original Bilibili page, BewlyBewly will only show the top bar inside the iframe.
  // This helps prevent the outside top bar from covering the contents.
  // reference: https://github.com/BewlyBewly/BewlyBewly/issues/1235

  // when using original bilibili homepage, show top bar
  return settings.value.useOriginalBilibiliHomepage
  // when on home page and not using original bilibili page, show top bar
    || (isHomePage() && !settingsStore.getDockItemIsUseOriginalBiliPage(activatedPage.value) && !isInIframe())
  // when in iframe and using original bilibili page, show top bar
    || (settingsStore.getDockItemIsUseOriginalBiliPage(activatedPage.value) && isInIframe())
  // when not on home page, show top bar
    || !isHomePage()
})

const isFirstTimeActivatedPageChange = ref<boolean>(true)
watch(
  () => activatedPage.value,
  () => {
    mainStore.setActivatedCover('')

    if (!isFirstTimeActivatedPageChange.value) {
      // Update the URL query parameter when activatedPage changes
      const url = new URL(window.location.href)
      url.searchParams.set('page', activatedPage.value)
      window.history.replaceState({}, '', url.toString())
    }

    if (scrollbarRef.value) {
      const osInstance = scrollbarRef.value.osInstance()
      osInstance.elements().viewport.scrollTop = 0
    }
    isFirstTimeActivatedPageChange.value = false
  },
  { immediate: true },
)

watch([() => showTopBar.value, () => activatedPage.value], () => {
  // Remove the original Bilibili top bar when using original bilibili page to avoid two top bars showing
  const biliHeader = document.querySelector('.bili-header') as HTMLElement | null
  if (biliHeader && isHomePage()) {
    if (settingsStore.getDockItemIsUseOriginalBiliPage(activatedPage.value) && !isInIframe()) {
      biliHeader.style.visibility = 'hidden'
    }
    else {
      biliHeader.style.visibility = 'visible'
    }
  }
}, { immediate: true })

// Setup necessary settings watchers
setupNecessarySettingsWatchers()

onMounted(() => {
  window.dispatchEvent(new CustomEvent(BEWLY_MOUNTED))

  if (isHomePage()) {
    // Force overwrite Bilibili Evolved body tag & html tag background color
    document.body.style.setProperty('background-color', 'unset', 'important')
  }
  // document.documentElement.style.setProperty('font-size', '14px')

  document.addEventListener('scroll', () => {
    if (window.scrollY > 0)
      reachTop.value = false
    else
      reachTop.value = true
  })
})

function handleDockItemClick(dockItem: DockItem) {
  // Opening in a new tab while still on the current tab doesn't require changing the `activatedPage`
  if (dockItem.openInNewTab) {
    openLinkToNewTab(`https://www.bilibili.com/?page=${dockItem.page}`)
  }
  else {
    if (dockItem.useOriginalBiliPage) {
      // It seem like the `activatedPage` watcher above will handle this, so no need to set iframePageURL.value here
      // iframePageURL.value = dockItem.url
      if (!isHomePage()) {
        location.href = `https://www.bilibili.com/?page=${dockItem.page}`
      }
    }
    else {
      if (isHomePage()) {
        // Replace NextTick with setTimeout(200), otherwise osInstance in function 'changeActivatePage' will be undefined
        setTimeout(() => {
          changeActivatePage(dockItem.page)
        }, 200)
      }
      else {
        location.href = `https://www.bilibili.com/?page=${dockItem.page}`
      }
    }

    // When not opened in a new tab, change the `activatedPage`
    activatedPage.value = dockItem.page
  }
}

function changeActivatePage(pageName: AppPage) {
  const osInstance = scrollbarRef.value?.osInstance()
  const scrollTop: number = osInstance.elements().viewport.scrollTop

  if (activatedPage.value === pageName) {
    if (activatedPage.value !== AppPage.Search) {
      if (scrollTop === 0)
        handleThrottledPageRefresh()
      else
        handleThrottledBackToTop()
    }
    return
  }
  activatedPage.value = pageName
}

function handleBackToTop(targetScrollTop = 0 as number) {
  const osInstance = scrollbarRef.value?.osInstance()
  if (osInstance) {
    scrollToTop(osInstance.elements().viewport, targetScrollTop)
    topBarRef.value?.toggleTopBarVisible(true)
  }

  iframePageRef.value?.handleBackToTop()
}

function handleOsScroll() {
  emitter.emit(OVERLAY_SCROLL_BAR_SCROLL)

  const osInstance = scrollbarRef.value?.osInstance()
  const { viewport } = osInstance.elements()
  const { scrollTop, scrollHeight, clientHeight } = viewport // get scroll offset

  if (scrollTop === 0) {
    reachTop.value = true
  }
  else {
    reachTop.value = false
  }

  if (clientHeight + scrollTop >= scrollHeight - 300)
    handleThrottledReachBottom()

  if (isHomePage())
    topBarRef.value?.handleScroll()
}

function openIframeDrawer(url: string) {
  const isSameOrigin = (origin: URL, destination: URL) =>
    origin.protocol === destination.protocol && origin.host === destination.host && origin.port === destination.port

  const currentUrl = new URL(location.href)
  const destination = new URL(url)

  try {
    if (!isSameOrigin(currentUrl, destination)) {
      openLinkToNewTab(url)
      return
    }
  }
  catch {
    openLinkToNewTab(url)
    return
  }

  iframeDrawerURL.value = url
  showIframeDrawer.value = true
}

/**
 * Checks if the current viewport has a scrollbar.
 * @returns {boolean} Returns true if the viewport has a scrollbar, false otherwise.
 */
async function haveScrollbar() {
  await nextTick()
  const osInstance = scrollbarRef.value?.osInstance()
  // If the scrollbarRef is not ready, return false
  if (osInstance) {
    const { viewport } = osInstance.elements()
    const { scrollHeight } = viewport // get scroll offset
    return scrollHeight > window.innerHeight
  }
  else {
    return false
  }
}

// In drawer video, watch btn className changed and post message to parent
watchEffect(async (onCleanUp) => {
  if (!isInIframe())
    return null

  const observer = new MutationObserver(([{ target: el }]) => {
    if (!(el instanceof HTMLElement))
      return null
    if (el.classList.contains('bpx-state-entered')) {
      parent.postMessage(DRAWER_VIDEO_ENTER_PAGE_FULL)
    }
    else {
      parent.postMessage(DRAWER_VIDEO_EXIT_PAGE_FULL)
    }
  })

  const abort = new AbortController()
  queryDomUntilFound('.bpx-player-ctrl-btn.bpx-player-ctrl-web', 500, abort).then((openVideo2WebFullBtn) => {
    if (!openVideo2WebFullBtn)
      return
    observer.observe(openVideo2WebFullBtn, { attributes: true })
  })

  onCleanUp(() => {
    observer.disconnect()
    abort.abort()
  })
})

provide<BewlyAppProvider>('BEWLY_APP', {
  activatedPage,
  mainAppRef,
  scrollbarRef,
  reachTop,
  handleBackToTop,
  handlePageRefresh,
  handleReachBottom,
  handleUndoRefresh,
  handleForwardRefresh,
  showUndoButton,
  openIframeDrawer,
  haveScrollbar,
})

/* Add 'BewlyInternalResource' suffix to prevent conflict with local fonts. */
const fontStyles = document.createElement('style')
fontStyles.textContent = `
@font-face {
    font-family: "Cantarell-BewlyInternalResource"; /* 西文 */
    font-display: block;
    src: url(${browser.runtime.getURL('/assets/fonts/Cantarell-VF.otf')}) format("opentype-variations");
}

@font-face {
    font-family: "DroidSansMono-BewlyInternalResource"; /* 西文等宽 */
    font-display: block;
    src: url(${browser.runtime.getURL('/assets/fonts/DroidSansMono.ttf')});
}

@font-face {
    font-family: "ShangguSansSCVF-BewlyInternalResource"; /* CJK 旧字形 */
    font-display: block;
    src: url(${browser.runtime.getURL('/assets/fonts/ShangguSansSC-VF.woff2')}) format("woff2-variations");
}

@font-face {
    font-family: "FlexSansGBVF-BewlyInternalResource"; /* CJK 新字形 */
    font-display: block;
    src: url(${browser.runtime.getURL('/assets/fonts/FlexSansGBVF.ttf')}) format("truetype-variations");
}
`

document.head.appendChild(fontStyles)

if (settings.value.blockVIPDanmukuStyle) {
  const playerProfile = localStorage.getItem('bpx_player_profile')
  const parsedProfile = playerProfile ? JSON.parse(playerProfile) : {}
  const strokeType = parsedProfile.dmSetting?.fontborder || 0
  const textShadow = (() => {
    if (strokeType === 1)
      return '0 0 1px #000,0 0 1px #000,0 0 1px #000'
    if (strokeType === 2)
      return '1px 1px 2px #000,0 0 1px #000'
    return '1px 0 1px #000,0 1px 1px #000,0 -1px 1px #000,-1px 0 1px #000'
  })()
  const styleElement = document.createElement('style')
  styleElement.innerHTML = `.bili-dm,.bili-danmaku-x-dm{--textShadow:${textShadow}}.bili-dm-vip,.bili-danmaku-x-dm-vip{background-image:none !important;text-shadow:inherit !important}`
  document.body.appendChild(styleElement)
}

if (settings.value.cleanUrlArgument) {
  const PARAMS_TO_REMOVE = [
    'spm_id_from',
    'from_source',
    'msource',
    'bsource',
    'seid',
    'source',
    'session_id',
    'visit_id',
    'sourceFrom',
    'from_spmid',
    'share_source',
    'share_medium',
    'share_plat',
    'share_session_id',
    'share_tag',
    'unique_k',
    'csource',
    'vd_source',
    'tab',
    'is_story_h5',
    'share_from',
    'plat_id',
    '-Arouter',
    'launch_id',
    'live_from',
    'hotRank',
    'broadcast_type',
  ]

  function cleanUrlParams() {
    const currentUrl = new URL(window.location.href)
    let hasChanged = false

    PARAMS_TO_REMOVE.forEach((param) => {
      if (currentUrl.searchParams.has(param)) {
        currentUrl.searchParams.delete(param)
        hasChanged = true
      }
    })

    if (hasChanged) {
      const newUrl = currentUrl.toString()
        .replace(/([^:])\/\//g, '$1/')
        .replace(/%3D/gi, '=')
        .replace(/%26/g, '&')
      history.replaceState(null, '', newUrl)
    }
  }

  const cleanupStrategies = [
    () => window.addEventListener('load', cleanUrlParams),
    () => document.addEventListener('DOMContentLoaded', cleanUrlParams),
    () => setTimeout(cleanUrlParams, 1500),
    () => window.requestIdleCallback?.(cleanUrlParams),
  ]

  if (document.readyState === 'complete') {
    setTimeout(cleanUrlParams, 300)
  }
  else {
    cleanupStrategies.forEach(strategy => strategy())
  }

  if (typeof window !== 'undefined') {
    let lastUrl = window.location.href
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        setTimeout(cleanUrlParams, 300)
      }
    }, 500)
  }
}

if (settings.value.bvToAv) {
  const TABLE = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'
  const XOR_CODE = 23442827791579n
  const MASK = (1n << 51n) - 1n

  function bv2av(bv: string): string {
    if (!bv.startsWith('BV1'))
      return bv
    const chars = [...bv];
    [chars[3], chars[9]] = [chars[9], chars[3]];
    [chars[4], chars[7]] = [chars[7], chars[4]]

    let tmp = 0n
    for (const c of chars.slice(3)) {
      tmp = tmp * 58n + BigInt(TABLE.indexOf(c))
    }
    return `av${((tmp & MASK) ^ XOR_CODE).toString()}`
  }

  function handleUrl() {
    const match = window.location.pathname.match(/(\/video\/)(BV1[\dA-Za-z]{9})/)
    if (!match)
      return

    const av = bv2av(match[2])
    if (av === match[2])
      return

    const newUrl = window.location.href.replace(match[2], av)
    history.replaceState(null, '', newUrl)
  }

  window.addEventListener('popstate', handleUrl)
  new MutationObserver(handleUrl).observe(document, { subtree: true, childList: true })
  handleUrl()
}

const removeLeftQuoteIndent = document.createElement('style')
removeLeftQuoteIndent.textContent = `
.video-info-container .special-text-indent[data-title^='“'],a[title^='“'],p[title^='“'],h3[title^='“'] {
  text-indent: 0 !important;
}
`

document.head.appendChild(removeLeftQuoteIndent)
</script>

<template>
  <div
    id="bewly-wrapper"
    ref="mainAppRef"
    class="bewly-wrapper"
    :class="{ dark: isDark }"
    text="$bew-text-1 size-$bew-base-font-size"
  >
    <!-- Background -->
    <template v-if="showBewlyPage">
      <AppBackground :activated-page="activatedPage" />
    </template>

    <!-- Settings -->
    <KeepAlive>
      <Settings v-if="showSettings" z-10002 @close="showSettings = false" />
    </KeepAlive>

    <!-- Dock & RightSideButtons -->
    <div
      v-if="!isInIframe()"
      pos="absolute top-0 left-0" w-full h-full overflow-hidden
      pointer-events-none
    >
      <Dock
        v-if="!settings.useOriginalBilibiliHomepage && (settings.alwaysUseDock || (showBewlyPage || iframePageURL))"
        pointer-events-auto
        :activated-page="activatedPage"
        @settings-visibility-change="toggleSettings"
        @refresh="handleThrottledPageRefresh"
        @undo-refresh="handleThrottledPageUnRefresh"
        @forward-refresh="handleThrottledPageForwardRefresh"
        @back-to-top="handleThrottledBackToTop"
        @dock-item-click="handleDockItemClick"
      />
      <SideBar
        v-else
        pointer-events-auto
        @settings-visibility-change="toggleSettings"
      />
    </div>

    <!-- TopBar -->
    <div
      v-if="showTopBar"
      m-auto max-w="$bew-page-max-width"
    >
      <BewlyOrBiliTopBarSwitcher v-if="settings.showBewlyOrBiliTopBarSwitcher" />

      <OldTopBar
        v-if="settings.useOldTopBar"
        pos="top-0 left-0" z="99 hover:1001" w-full
      />
      <TopBar
        v-else
        pos="top-0 left-0" z="99 hover:1001" w-full
      />
    </div>

    <div
      v-if="!settings.useOriginalBilibiliHomepage"
      pos="absolute top-0 left-0" w-full h-full
      :style="{
        height: showBewlyPage || iframePageURL ? '100dvh' : '0',
      }"
    >
      <Transition name="fade">
        <template v-if="showBewlyPage">
          <OverlayScrollbarsComponent ref="scrollbarRef" element="div" h-inherit defer @os-scroll="handleOsScroll">
            <main m-auto max-w="$bew-page-max-width">
              <div
                p="t-[calc(var(--bew-top-bar-height)+10px)]" m-auto
                w="lg:[calc(100%-200px)] [calc(100%-150px)]"
              >
                <Transition name="page-fade">
                  <Component :is="pages[activatedPage]" />
                </Transition>
              </div>
            </main>
          </OverlayScrollbarsComponent>
        </template>
      </Transition>

      <Transition v-if="!showBewlyPage && iframePageURL && !isInIframe()" name="fade">
        <IframePage ref="iframePageRef" :url="iframePageURL" />
      </Transition>
    </div>

    <IframeDrawer
      v-if="showIframeDrawer"
      :url="iframeDrawerURL"
      @close="showIframeDrawer = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.bewly-wrapper {
  // To fix the filter used in `.bewly-wrapper` that cause the positions of elements become discorded.
  > * > * {
    filter: var(--bew-filter-force-dark);
  }
}
</style>
