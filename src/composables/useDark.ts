import { effectScope } from 'vue'

import { settings } from '~/logic'
import { runWhenIdle } from '~/utils/lazyLoad'
import { getCookie, setCookie } from '~/utils/main'
import { executeTimes } from '~/utils/timer'

function readSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getSavedThemeCookie(): 'dark' | 'light' | null {
  if (typeof document === 'undefined')
    return null
  const saved = getCookie('theme_style')
  if (saved === 'dark' || saved === 'light')
    return saved
  return null
}

function syncDomAppearance(dark: boolean) {
  if (typeof document === 'undefined')
    return

  const bewlyEl = document.querySelector('#bewly')
  const docEl = document.documentElement

  if (dark) {
    bewlyEl?.classList.add('dark')
    docEl.classList.add('dark')
    nextTick(() => {
      document.body?.classList.add('dark')
    })
  }
  else {
    bewlyEl?.classList.remove('dark')
    docEl.classList.remove('dark')
    nextTick(() => {
      document.body?.classList.remove('dark')
    })
  }

  // Only used as a temporary solution, which will eventually be removed
  // It seems like Bilibili already supports dark mode when the `bili_dark` class is added to the `html` element
  // but it's not yet fully refined.
  if (docEl.classList.contains('bili_dark'))
    docEl.classList.remove('bili_dark')

  docEl.setAttribute('data-bewly-theme', dark ? 'dark' : 'light')
}

function createDarkState() {
  const scope = effectScope(true)
  return scope.run(() => {
    const isPreferredDark = ref(readSystemDark())
    const isSettingsReady = ref(false)
    const isDocumentLoading = ref(typeof document !== 'undefined' && document.readyState === 'loading')
    let themeChangeTimer: NodeJS.Timeout | null = null
    let idleTask: { dispose: () => void } | null = null
    let didAttachLoadingListeners = false

    const refreshSystemDark = () => {
      isPreferredDark.value = readSystemDark()
    }

    settings.ready.finally(() => {
      isSettingsReady.value = true
      refreshSystemDark()
    })

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery?.addEventListener?.('change', (event) => {
        isPreferredDark.value = event.matches
      })
    }

    const ensureLoadingListeners = () => {
      if (didAttachLoadingListeners || typeof document === 'undefined' || document.readyState !== 'loading')
        return
      didAttachLoadingListeners = true

      const onReadyStateChange = () => {
        refreshSystemDark()
        if (document.readyState !== 'loading') {
          isDocumentLoading.value = false
          document.removeEventListener('readystatechange', onReadyStateChange)
        }
      }
      document.addEventListener('readystatechange', onReadyStateChange)
      document.addEventListener('DOMContentLoaded', () => {
        refreshSystemDark()
        isDocumentLoading.value = false
      }, { once: true })
    }

    ensureLoadingListeners()

    if (typeof window !== 'undefined') {
      window.addEventListener('load', refreshSystemDark, { once: true })
      window.addEventListener('pageshow', refreshSystemDark)
    }

    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(refreshSystemDark)

    runWhenIdle(refreshSystemDark)

    const currentSystemColorScheme = computed((): 'dark' | 'light' => isPreferredDark.value ? 'dark' : 'light')
    const isThemeSettled = computed(() =>
      settings.value.theme !== 'auto'
      || (isSettingsReady.value && (isPreferredDark.value || !isDocumentLoading.value)),
    )
    const currentAppColorScheme = computed((): 'dark' | 'light' => {
      if (settings.value.theme !== 'auto')
        return settings.value.theme

      if (!isSettingsReady.value) {
        const saved = getSavedThemeCookie()
        if (saved)
          return saved
      }

      if (isPreferredDark.value)
        return 'dark'

      if (isDocumentLoading.value) {
        const saved = getSavedThemeCookie()
        if (saved)
          return saved
      }

      return 'light'
    })
    const isDark = computed(() => currentAppColorScheme.value === 'dark')

    // Watch for changes in the resolved theme and update the '#bewly' / root classes and Bilibili theme cookie
    watch(
      () => [currentAppColorScheme.value, isThemeSettled.value] as const,
      ([scheme, settled]) => {
        if (themeChangeTimer) {
          clearInterval(themeChangeTimer)
          themeChangeTimer = null
        }

        syncDomAppearance(scheme === 'dark')

        if (settled) {
          setCookie('theme_style', scheme, 365 * 10)
          window.dispatchEvent(new CustomEvent('global.themeChange', { detail: scheme }))
        }
      },
      { immediate: true },
    )

    watch(
      () => [currentAppColorScheme.value, isThemeSettled.value] as const,
      ([scheme, settled]) => {
        idleTask?.dispose()
        idleTask = null

        if (!settled)
          return

        // Because some shadow dom may not be loaded when the page has already loaded, we need to wait until the page is idle
        idleTask = runWhenIdle(() => {
          if (themeChangeTimer) {
            clearInterval(themeChangeTimer)
            themeChangeTimer = null
          }
          setCookie('theme_style', scheme, 365 * 10)
          // TODO: find a better way implement this
          themeChangeTimer = executeTimes(() => {
            window.dispatchEvent(new CustomEvent('global.themeChange', { detail: scheme }))
          }, 10, 500)
        })
      },
      { immediate: true },
    )

    function toggleDark(e: MouseEvent) {
      const updateThemeSettings = () => {
        if (currentAppColorScheme.value !== currentSystemColorScheme.value)
          settings.value.theme = 'auto'
        else
          settings.value.theme = isPreferredDark.value ? 'light' : 'dark'
      }

      const isAppearanceTransition = typeof document !== 'undefined'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!isAppearanceTransition) {
        updateThemeSettings()
      }
      else {
        const x = e.clientX
        const y = e.clientY
        const endRadius = Math.hypot(
          Math.max(x, innerWidth - x),
          Math.max(y, innerHeight - y),
        )
        // https://github.com/vueuse/vueuse/pull/3129
        const style = document.createElement('style')
        const styleString = `
            *, *::before, *::after
            {transition:none!important}`
        style.appendChild(document.createTextNode(styleString))
        document.head.appendChild(style)

        // Since the above normal dom style cannot be applied in shadow dom style
        // We need to add this style again to the shadow dom
        const shadowDomStyle = document.createElement('style')
        const shadowDomStyleString = `
            *, *::before, *::after
            {transition:none!important; will-change: background}`
        shadowDomStyle.appendChild(document.createTextNode(shadowDomStyleString))

        const bewlyShadowRoot = document.getElementById('bewly')?.shadowRoot
        const bewlyWrapper = bewlyShadowRoot?.getElementById('bewly-wrapper')
        if (!bewlyWrapper)
          throw new Error('mainAppRef is not found')

        bewlyWrapper.appendChild(shadowDomStyle)

        const transition = document.startViewTransition(async () => {
          updateThemeSettings()
          await nextTick()
        })

        transition.ready.then(() => {
          const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ]
          const animation = document.documentElement.animate(
            {
              clipPath: currentAppColorScheme.value === 'dark'
                ? [...clipPath].reverse()
                : clipPath,
            },
            {
              duration: 300,
              easing: 'ease-in-out',
              pseudoElement: currentAppColorScheme.value === 'dark'
                ? '::view-transition-old(root)'
                : '::view-transition-new(root)',
            },
          )
          animation.addEventListener('finish', () => {
            document.head.removeChild(style!)
            bewlyWrapper.removeChild(shadowDomStyle!)
          }, { once: true })
        })
      }
    }

    return {
      isDark,
      isDocumentLoading,
      toggleDark,
      refreshSystemDark,
      ensureLoadingListeners,
    }
  })!
}

let darkState: ReturnType<typeof createDarkState> | null = null

export function useDark() {
  if (!darkState)
    darkState = createDarkState()

  if (typeof document !== 'undefined')
    darkState.isDocumentLoading.value = document.readyState === 'loading'
  darkState.ensureLoadingListeners()
  darkState.refreshSystemDark()
  syncDomAppearance(darkState.isDark.value)

  return {
    isDark: darkState.isDark,
    toggleDark: darkState.toggleDark,
  }
}
