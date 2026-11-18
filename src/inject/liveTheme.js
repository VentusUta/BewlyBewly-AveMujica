// 让直播站原生的`bililiveThemeV2`与`html[lab-style]`跟随Bewly的亮暗主题，只在直播站的顶层页面加载
(() => {
  const rawMethods = new WeakMap()

  function getDesiredTheme() {
    const attr = document.documentElement?.getAttribute('data-bewly-theme')
    return attr === 'dark' || attr === 'light' ? attr : ''
  }

  function clearHostOnlyThemeCookie() {
    document.cookie = 'theme_style=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  }

  function syncLabStyle(theme) {
    const root = document.documentElement
    if (!root)
      return

    const currentAttr = root.getAttribute('lab-style') || ''
    const tokens = currentAttr
      .split(',')
      .map(token => token.trim())
      .filter(token => token && token !== 'dark')
    if (theme === 'dark')
      tokens.push('dark')

    const next = tokens.join(',')
    if (root.getAttribute('lab-style') !== next)
      root.setAttribute('lab-style', next)
    if (root.style.colorScheme !== theme)
      root.style.colorScheme = theme
  }

  function patchBililiveThemeV2(themeApi) {
    if (!themeApi || typeof themeApi !== 'object' || rawMethods.has(themeApi))
      return themeApi

    const origInit = typeof themeApi.initThemeWithCSR === 'function'
      ? themeApi.initThemeWithCSR.bind(themeApi)
      : null
    const origChange = typeof themeApi.changeTheme === 'function'
      ? themeApi.changeTheme.bind(themeApi)
      : null

    rawMethods.set(themeApi, { origInit, origChange })

    if (origInit) {
      themeApi.initThemeWithCSR = function initThemeWithCSR(requestedTheme) {
        const desired = getDesiredTheme()
        const effective = desired || requestedTheme
        origInit(effective)
        clearHostOnlyThemeCookie()
        if (effective === 'dark' || effective === 'light')
          syncLabStyle(effective)
      }
    }

    if (origChange) {
      themeApi.changeTheme = function changeTheme(requestedTheme) {
        const desired = getDesiredTheme()
        const effective = desired || requestedTheme
        const cssMapEl = document.getElementById('__css-map__')
        if (cssMapEl && !(cssMapEl.getAttribute('href') || '').endsWith(`/${effective}.css`))
          origChange(effective)
        clearHostOnlyThemeCookie()
        if (effective === 'dark' || effective === 'light')
          syncLabStyle(effective)
      }
    }

    return themeApi
  }

  let currentThemeApi
  const descriptor = Object.getOwnPropertyDescriptor(window, 'bililiveThemeV2')
  if (!descriptor || descriptor.configurable) {
    if (window.bililiveThemeV2)
      currentThemeApi = patchBililiveThemeV2(window.bililiveThemeV2)

    Object.defineProperty(window, 'bililiveThemeV2', {
      configurable: true,
      enumerable: true,
      get() {
        return currentThemeApi
      },
      set(val) {
        currentThemeApi = patchBililiveThemeV2(val)
      },
    })
  }

  function applyDesiredTheme() {
    const desired = getDesiredTheme()
    if (!desired)
      return

    const themeApi = window.bililiveThemeV2
    const cssMapEl = document.getElementById('__css-map__')
    if (!themeApi && !cssMapEl)
      return

    const methods = themeApi ? rawMethods.get(themeApi) : null
    if (!cssMapEl && methods?.origInit) {
      methods.origInit(desired)
    }
    else if (cssMapEl && !(cssMapEl.getAttribute('href') || '').endsWith(`/${desired}.css`)) {
      if (methods?.origChange) {
        methods.origChange(desired)
      }
      else {
        const href = cssMapEl.getAttribute('href') || ''
        if (/\/(?:light|dark)\.css$/.test(href))
          cssMapEl.setAttribute('href', href.replace(/\/(?:light|dark)\.css$/, `/${desired}.css`))
      }
    }

    clearHostOnlyThemeCookie()
    syncLabStyle(desired)
  }

  if (document.documentElement) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-bewly-theme') {
          applyDesiredTheme()
          break
        }
        if (mutation.attributeName === 'lab-style') {
          const desired = getDesiredTheme()
          if (desired && (window.bililiveThemeV2 || document.getElementById('__css-map__')))
            syncLabStyle(desired)
        }
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bewly-theme', 'lab-style'],
    })
  }

  window.addEventListener('global.themeChange', applyDesiredTheme)
  document.addEventListener('DOMContentLoaded', applyDesiredTheme, { once: true })
  applyDesiredTheme()
})()
