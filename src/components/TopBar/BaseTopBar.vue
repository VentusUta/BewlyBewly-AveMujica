<script setup lang="ts">
import { onKeyStroke, useMouseInElement } from '@vueuse/core'

import { useBewlyApp } from '~/composables/useAppProvider'
import { useDark } from '~/composables/useDark'
import { useWebFullscreen } from '~/composables/useWebFullscreen'
import { useWheelContain } from '~/composables/useWheelContain'
import { TOP_BAR_VISIBILITY_CHANGE } from '~/constants/globalEvents'
import { settings } from '~/logic'
import { useSessionStore } from '~/stores/sessionStore'
import { removeHttpFromUrl } from '~/utils/main'
import emitter from '~/utils/mitt'

import MorePop from './components/MorePop.vue'
import NotificationsDrawer from './components/NotificationsDrawer.vue'
import TopBarNavItem from './components/TopBarNavItem.vue'
import UserPanelPop from './components/UserPanelPop.vue'
import { provideTopBarPopups, useTopBarPopup } from './composables/useTopBarPopups'

const {
  showTopBar = true,
  isFixed = true,
  forceWhiteIcon = false,
  showSearchBar = true,
  searchType = 'all',
} = defineProps<{
  showTopBar?: boolean
  isFixed?: boolean
  forceWhiteIcon?: boolean
  showSearchBar?: boolean
  searchType?: 'all' | 'live'
  logoHref: string
  logoTitle?: string
  moreItems?: { name: string, url: string, icon: string, target?: string }[]
}>()

const { activatedPage, reachTop } = useBewlyApp()
const { isDark } = useDark()
const session = useSessionStore()
const mid = computed(() => session.userID ?? '')

const popups = provideTopBarPopups()
const logoRef = ref<HTMLElement | null>(null)
const avatarRef = ref<HTMLElement | null>(null)
const logo = useTopBarPopup('channels', logoRef, popups)
const avatar = useTopBarPopup('userPanel', avatarRef, popups)

const topMaskGradient = computed(() => {
  const stopColor = forceWhiteIcon
    ? 'rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.4) calc(var(--bew-top-bar-height) / 2)'
    : 'color-mix(in oklab, var(--bew-bg), transparent 20%), color-mix(in oklab, var(--bew-bg), transparent 40%) calc(var(--bew-top-bar-height) / 2)'
  return `linear-gradient(to bottom, ${stopColor}, transparent)`
})

const searchBarStyle = computed((): Record<string, string> => {
  return {
    '--b-search-bar-normal-color': settings.value.disableFrostedGlass
      ? 'var(--bew-elevated)'
      : 'color-mix(in oklab, var(--bew-elevated-solid), transparent 60%)',
    '--b-search-bar-hover-color': 'var(--bew-elevated-hover)',
    '--b-search-bar-focus-color': 'var(--bew-elevated)',
    '--b-search-bar-normal-icon-color': forceWhiteIcon && !settings.value.disableFrostedGlass ? 'white' : 'var(--bew-text-1)',
    '--b-search-bar-normal-text-color': forceWhiteIcon && !settings.value.disableFrostedGlass ? 'white' : 'var(--bew-text-1)',
  }
})

const hideTopBar = ref<boolean>(false)
const headerTarget = ref<HTMLElement | null>(null)
const { isOutside: isOutsideTopBar } = useMouseInElement(headerTarget)
if (__TARGET_BROWSER__ === 'safari')
  useWheelContain(headerTarget, '.bew-popover')

const scrollTop = ref<number>(0)
const oldScrollTop = ref<number>(0)

const drawerVisible = reactive({
  notifications: false,
})
const notificationsDrawerUrl = ref<string>('https://message.bilibili.com/')

function openNotificationsDrawer(url?: string) {
  if (!settings.value.openNotificationsPageAsDrawer)
    return
  if (url)
    notificationsDrawerUrl.value = url
  drawerVisible.notifications = true
}

function toggleTopBarVisible(visible: boolean) {
  hideTopBar.value = !visible
  emitter.emit(TOP_BAR_VISIBILITY_CHANGE, visible)
}

function handleScroll() {
  scrollTop.value = document.documentElement.scrollTop

  if (scrollTop.value === 0)
    toggleTopBarVisible(true)

  if (settings.value.autoHideTopBar && isOutsideTopBar.value && scrollTop.value !== 0) {
    if (scrollTop.value > oldScrollTop.value)
      toggleTopBarVisible(false)
    else
      toggleTopBarVisible(true)
  }

  oldScrollTop.value = scrollTop.value
}

watch(() => settings.value.autoHideTopBar, (newVal) => {
  if (!newVal)
    toggleTopBarVisible(true)
})

watch(activatedPage, () => {
  toggleTopBarVisible(true)
})

const { isWebFullscreen } = useWebFullscreen()
watch(isWebFullscreen, webFullscreen => toggleTopBarVisible(!webFullscreen))

onKeyStroke('/', () => {
  toggleTopBarVisible(true)
})

onMounted(() => {
  void session.getUserInfo()
  nextTick(() => {
    toggleTopBarVisible(true)
    window.addEventListener('scroll', handleScroll)
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

defineExpose({
  toggleTopBarVisible,
  handleScroll,
})
</script>

<template>
  <Transition name="top-bar">
    <header
      v-if="showTopBar"
      ref="headerTarget"
      w="full" transition="all 300 ease-in-out"
      :class="{ 'hide': hideTopBar, 'force-white-icon': forceWhiteIcon }"
      :style="{ position: isFixed ? 'fixed' : 'absolute' }"
    >
      <main
        max-w="$bew-page-max-width"
        flex="~ justify-between items-center gap-4"
        p="x-12" m-auto
        h="$bew-top-bar-height"
      >
        <div
          v-if="!reachTop"
          style="
            mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 1) 24px, rgba(0, 0, 0, 0.9) 44px, transparent);
          "
          :style="{ backdropFilter: settings.disableFrostedGlass ? 'none' : 'blur(12px)' }"
          pos="absolute top-0 left-0" w-full h="[calc(var(--bew-top-bar-height)+16px)]"
          pointer-events-none transform-gpu
        />

        <div
          pos="absolute top-0 left-0" w-full
          pointer-events-none opacity-100 duration-300
          :style="{
            background: topMaskGradient,
            opacity: reachTop ? 0.8 : 1,
            height: reachTop ? 'var(--bew-top-bar-height)' : 'calc(var(--bew-top-bar-height) + 20px)',
          }"
        />

        <Transition name="fade">
          <div
            v-if="settings.showTopBarThemeColorGradient && !forceWhiteIcon && reachTop && isDark"
            pos="absolute top-0 left-0" w-full h="$bew-top-bar-height" pointer-events-none
            :style="{ background: 'linear-gradient(to bottom, var(--bew-theme-color-10), transparent)' }"
          />
        </Transition>

        <div shrink-0 flex="inline xl:1 justify-start items-center gap-2" pos="relative" z-1>
          <div
            ref="logoRef"
            z-1 relative w-fit
          >
            <a
              :href="logoHref"
              :title="logoTitle"
              target="_top"
              class="group logo"
              :class="{ activated: logo.isOpen.value }"
              grid="~ place-items-center"
              rounded="46px" duration-300
              w-46px h-46px transform-gpu
              bg="hover:$bew-theme-color"
              @click="logo.handleClick"
            >
              <svg
                t="1720198072316" class="icon" viewBox="0 0 1024 1024" version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="1477" width="36" height="36"
                :style="{
                  fill: forceWhiteIcon ? 'white' : 'var(--bew-theme-color)',
                  filter: forceWhiteIcon ? 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.6))' : 'drop-shadow(0 0 4px var(--bew-theme-color-60))',
                }"
                group-hover:fill="!white"
                group-hover:filter="!none"
                duration-300 mt--1px
              >
                <path d="M450.803484 456.506027l-120.670435 23.103715 10.333298 45.288107 119.454151-23.102578-9.117014-45.289244z m65.04448 120.060586c-29.483236 63.220622-55.926329 15.502222-55.926328 15.502223l-19.754098 12.768142s38.90176 53.192249 75.986489 12.764729c43.770311 40.42752 77.203911-13.068516 77.203911-13.068516l-17.934791-11.55072c0.001138-0.304924-31.305956 44.983182-59.575183-16.415858z m59.57632-74.773617L695.182222 524.895573l10.029511-45.288106-120.364373-23.103716-9.423076 45.289245z m237.784178-88.926436c-1.905778-84.362809-75.487004-100.540871-75.487004-100.540871s-57.408853-0.316302-131.944676-0.95232l54.237867-52.332089s8.562916-10.784996-6.026809-22.834062c-14.592-12.051342-15.543182-6.660551-20.615396-3.487289-4.441884 3.169849-69.462471 66.920676-80.878933 78.340551-29.494613 0-60.2624-0.319716-90.075591-0.319716h10.466418s-77.705671-76.754489-82.781298-80.241777c-5.075627-3.488427-5.709369-8.56064-20.616533 3.487289-14.589724 12.05248-6.026809 22.8352-6.026809 22.8352l55.504213 53.919288c-60.261262 0-112.280462 0.319716-136.383147 1.268623-78.025387 22.521173-71.99744 100.859449-71.99744 100.859449s0.950044 168.100978 0 253.103217c8.562916 85.00224 73.899804 98.636231 73.899805 98.636231s26.007324 0.63488 45.357511 0.63488c1.900089 5.391929 3.486151 32.034133 33.302756 32.034134 29.495751 0 33.30048-32.034133 33.30048-32.034134s217.263218-0.950044 235.340231-0.950044c0.953458 9.196658 5.394204 33.619058 35.207395 33.303893 29.494613-0.636018 31.714418-35.20512 31.714418-35.20512s10.151253-0.95232 40.280747 0c70.413653-13.005938 74.534684-95.468658 74.534684-95.468657s-1.265209-169.689316-0.312889-254.056676zM752.628622 681.8304c0 13.319964-10.467556 24.102684-23.471218 24.102684H300.980907c-13.003662 0-23.47008-10.78272-23.47008-24.102684V397.961671c0-13.32224 10.467556-24.106098 23.47008-24.106098h428.176497c13.003662 0 23.471218 10.783858 23.471218 24.106098v283.868729z" p-id="1478" />
              </svg>
            </a>

            <Transition name="slide-in">
              <div
                v-if="logo.isOpen.value && $slots['logo-popover']"
                class="logo-popover-wrap"
                @click.stop
              >
                <slot name="logo-popover" />
              </div>
            </Transition>
          </div>

          <slot name="left-extra" />
        </div>

        <div flex="inline 1 md:justify-center items-center" w="full">
          <Transition name="slide-out">
            <SearchBar
              v-if="showSearchBar"
              :search-type="searchType"
              class="search-bar"
              :style="searchBarStyle"
            />
          </Transition>
        </div>

        <nav
          class="top-bar-nav"
          flex="inline xl:1 justify-end items-center"
        >
          <div
            class="nav-items"
            flex="~ items-center gap-1" h-46px px-5px
            text="$bew-text-1"
            transform-gpu
          >
            <a
              v-if="session.status === 'loggedOut'"
              href="https://passport.bilibili.com/login"
              class="login"
            >
              <div i-solar:user-circle-bold-duotone class="text-xl mr-2" />{{
                $t('topbar.sign_in')
              }}
            </a>
            <template v-else>
              <div class="hidden lg:flex" gap-1 items-center>
                <slot
                  name="right-items"
                  :open-notifications-drawer="openNotificationsDrawer"
                />
              </div>

              <TopBarNavItem
                popup-key="more"
                keep="mounted"
                class="lg:!hidden flex"
              >
                <a title="More">
                  <div i-mingcute:menu-line />
                </a>

                <template #popover>
                  <MorePop :items="moreItems" />
                </template>
              </TopBarNavItem>

              <div
                ref="avatarRef"
                :class="{ hover: avatar.isOpen.value }"
                class="avatar"
                @click="avatar.handleClick"
              >
                <ALink
                  :href="`https://space.bilibili.com/${mid}`"
                  type="topBar"
                  class="avatar-img"
                  :class="{ hover: avatar.isOpen.value }"
                  :style="{
                    backgroundImage: `url(${session.userInfo?.face ? removeHttpFromUrl(session.userInfo.face) : ''})`,
                  }"
                />
                <div
                  class="avatar-shadow"
                  :class="{ hover: avatar.isOpen.value }"
                  :style="{
                    backgroundImage: `url(${session.userInfo?.face ? removeHttpFromUrl(session.userInfo.face) : ''})`,
                  }"
                />
                <svg
                  v-if="session.userInfo?.vip?.status === 1"
                  class="vip-img"
                  :class="{ hover: avatar.isOpen.value }"
                  :style="{ opacity: avatar.isOpen.value ? 1 : 0 }"
                  bg="[url(https://i0.hdslb.com/bfs/seed/jinkela/short/user-avatar/big-vip.svg)] contain no-repeat"
                  w="28%" h="28%" z-1
                  pos="absolute bottom--20px right-28px" duration-300
                />

                <Transition name="slide-in">
                  <UserPanelPop
                    v-if="avatar.isOpen.value && session.userInfo"
                    :user-info="session.userInfo"
                    class="bew-popover"
                    pos="!left-auto !right-0 !top-50px"
                    transform="!translate-x-0"
                    @click.stop
                  />
                </Transition>
              </div>
            </template>
          </div>
        </nav>
      </main>

      <KeepAlive v-if="settings.openNotificationsPageAsDrawer">
        <NotificationsDrawer
          v-if="drawerVisible.notifications"
          :url="notificationsDrawerUrl"
          @close="drawerVisible.notifications = false"
        />
      </KeepAlive>
    </header>
  </Transition>
</template>

<style scoped>
.top-bar-enter-active,
.top-bar-leave-active {
  transition: all 0.5s ease;
}

.top-bar-enter-from,
.top-bar-leave-to {
  --uno: "opacity-0 transform -translate-y-full";
}

.slide-in-enter-active,
.slide-in-leave-active {
  --uno: "transition-all duration-250 pointer-events-none transform-gpu";
}

.slide-in-leave-to,
.slide-in-enter-from {
  --uno: "transform mt--10px opacity-0";
}

/*
 * 小电视的悬浮卡外面包了一层用来定位，淡入淡出不能加在这层上：祖先一旦半透明，Safari里卡片的毛玻璃要等过渡结束才出现。
 * 这里只给出`--bew-popover-opacity`，由带毛玻璃的那层自己用它，默认是卡片的根元素。
 */
.logo-popover-wrap.slide-in-leave-to,
.logo-popover-wrap.slide-in-enter-from {
  opacity: 1;
  --bew-popover-opacity: 0;
}

.logo-popover-wrap.slide-in-enter-active > :deep(*),
.logo-popover-wrap.slide-in-leave-active > :deep(*) {
  --uno: "transition-opacity duration-250";
}

.slide-out-enter-active,
.slide-out-leave-active {
  --uno: "transition-all duration-300 pointer-events-none transform-gpu";
}

.slide-out-leave-to,
.slide-out-enter-from {
  --uno: "transform important:-translate-y-4 opacity-0";
}

.fade-enter-active,
.fade-leave-active {
  --uno: "transition-all duration-600";
}

.fade-leave-to,
.fade-enter-from {
  --uno: "opacity-0";
}

.hide {
  transform: translateY(-100%);
}

:deep(.search-bar) {
  & input:not(:focus, :focus-within) {
    --uno: "!border-$bew-border-color !shadow-$bew-shadow-1";
  }
}

.logo-popover-wrap {
  position: absolute;
  top: 0;
  left: 0;
}

.bew-popover,
.logo-popover-wrap > :deep(*) {
  position: absolute;
  overflow: hidden;
  overscroll-behavior: contain;
}

.logo-popover-wrap > :deep(*) {
  opacity: var(--bew-popover-opacity, 1);
}

.logo.activated {
  --uno: "bg-$bew-theme-color";

  &::after {
    content: "";
    position: absolute;
    left: 0;
    top: 44px;
    width: 46px;
    height: 12px;
  }

  svg {
    --uno: "!fill-white !filter-none";
  }
}

.login {
  --uno: "flex items-center h-34px px-4 rounded-40px text-base text-$bew-theme-color bg-$bew-theme-color-10";
  --uno: "relative z-5 duration-300 hover:bg-$bew-theme-color hover:text-white";
  filter: drop-shadow(0 0 4px var(--bew-bg));
}

.avatar {
  --uno: "flex justify-center items-center relative z-1 rounded-1/2 w-46px h-46px";

  /* Add a safety zone to prevent the avatar from collapsing quickly after leaving */
  &:hover::after,
  &.hover::after {
    --uno: "content-empty absolute right-0 top-20px w-110px h-120px";
  }

  .avatar-img,
  .avatar-shadow {
    --uno: "shrink-0 duration-300 rounded-1/2 w-34px h-34px bg-cover bg-center";

    &.hover {
      --uno: "transform scale-230 translate-y-50px translate-x--36px";
    }
  }

  .avatar-img {
    --uno: "z-1";
  }

  .avatar-shadow {
    --uno: "opacity-0 absolute top-0 z-0 pointer-events-none blur-sm";

    &.hover {
      --uno: "opacity-60";
    }
  }

  .vip-img {
    &.hover {
      --uno: "transform scale-180 translate-y-55px translate-15px";
    }
  }
}
</style>
