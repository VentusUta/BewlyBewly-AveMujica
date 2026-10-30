import { LanguageType } from '~/enums/appEnums'
import { settings } from '~/logic'
import type { Settings } from '~/logic/storage'
import { injectCSS } from '~/utils/main'

/* Add 'BewlyInternalResource' suffix to prevent conflict with local fonts. */
const fontFaces = `
@font-face {
    font-family: "EmDashFont-BewlyInternalResource"; /* U+2014 */
    unicode-range: U+2014;
    src: local(Tahoma), local(Arial);
}

@font-face {
    font-family: "MiddleDotFont-BewlyInternalResource"; /* Half-width middle dot (U+00B7) from Eliksiro Sans */
    unicode-range: U+00B7;
    font-weight: 100 700;
    line-gap-override: 0%;
    src: url(${browser.runtime.getURL('/assets/fonts/eliksiro-sans/woff2/EliksiroSans-VF-000.woff2')}) format(woff2) tech(variations);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Regular (400) */
    font-weight: normal;
    font-style: normal;
    font-feature-settings: "liga" off, "ss01" on, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-Regular.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Medium (500) */
    font-weight: 500;
    font-style: normal;
    font-feature-settings: "liga" off, "ss01" on, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-Medium.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Medium, treat as SemiBold (600) */
    font-weight: 600;
    font-style: normal;
    font-feature-settings: "liga" off, "ss01" on, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-Medium.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Bold (700) */
    font-weight: bold;
    font-style: normal;
    font-feature-settings: "liga" off, "ss01" on, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-Bold.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Italic Regular (400) */
    font-weight: normal;
    font-style: italic;
    font-feature-settings: "liga" off, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-Italic.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Italic Medium (500) */
    font-weight: 500;
    font-style: italic;
    font-feature-settings: "liga" off, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-MediumItalic.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Italic Medium, treat as SemiBold (600) */
    font-weight: 600;
    font-style: italic;
    font-feature-settings: "liga" off, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-MediumItalic.woff2')}) format(woff2);
}

@font-face {
    font-family: "OldRoboto-BewlyInternalResource"; /* Roboto Italic Bold (700) */
    font-weight: bold;
    font-style: italic;
    font-feature-settings: "liga" off, "ss02" on, "ss04" on;
    src: url(${browser.runtime.getURL('/assets/fonts/Roboto-BoldItalic.woff2')}) format(woff2);
}

@font-face {
    font-family: "ShangguSansSCVF-BewlyInternalResource"; /* Chinese characters old form */
    font-weight: 250 900;
    src: url(${browser.runtime.getURL('/assets/fonts/ShangguSansSC-VF.woff2')}) format(woff2) tech(variations);
}
`

const htmlLangs: Partial<Record<string, string>> = {
  [LanguageType.Mandarin_CN]: 'zh-CN',
  [LanguageType.Mandarin_TW]: 'zh-TW',
  [LanguageType.Cantonese]: 'zh-HK',
}

const preloadedFonts: Partial<Record<Settings['customizeFont'], [font: string, text?: string][]>> = {
  'recommend': [
    ['1em "MiddleDotFont-BewlyInternalResource"', '·'],
    ['1em "OldRoboto-BewlyInternalResource"'],
    ['500 1em "OldRoboto-BewlyInternalResource"'],
    ['1em "ShangguSansSCVF-BewlyInternalResource"'],
  ],
  'recommend-new': [
    ['1em "MiddleDotFont-BewlyInternalResource"', '·'],
    ['1em "OldRoboto-BewlyInternalResource"'],
    ['500 1em "OldRoboto-BewlyInternalResource"'],
    ['1em "EliksiroSans-BewlyInternalResource"'],
  ],
}

export function setupFonts() {
  injectCSS(fontFaces)

  const eliksiroSans = document.createElement('link')
  eliksiroSans.rel = 'stylesheet'
  eliksiroSans.href = browser.runtime.getURL('/assets/fonts/eliksiro-sans/eliksiro-sans.css')
  eliksiroSans.addEventListener('load', () => {
    for (const [font, text] of preloadedFonts[settings.value.customizeFont] ?? [])
      document.fonts.load(font, text).catch(() => {})
  }, { once: true })
  document.documentElement.append(eliksiroSans)

  watch(
    () => settings.value.language,
    (language) => {
      if (language)
        document.documentElement.lang = htmlLangs[language] ?? 'en'
    },
    { immediate: true },
  )

  watch(
    [() => settings.value.customizeFont, () => settings.value.fontFamily],
    () => {
      // Set the default font family
      if ((settings.value.customizeFont === 'default'
        || settings.value.customizeFont === 'recommend'
        || settings.value.customizeFont === 'recommend-new')
      && !settings.value.fontFamily) {
        settings.value.fontFamily = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Adwaita Sans", "Noto Sans", "Roboto Flex", Roboto, Cantarell, sans-serif, ui-sans-serif, system-ui, "Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", emoji`
      }

      if (settings.value.customizeFont === 'recommend') {
        document.documentElement.style.setProperty('--bew-font-family', 'var(--bew-fonts-recommend)')
      }

      if (settings.value.customizeFont === 'recommend-new') {
        document.documentElement.style.setProperty('--bew-font-family', 'var(--bew-fonts-recommend-new)')
      }

      if (settings.value.customizeFont === 'custom') {
        document.documentElement.style.setProperty('--bew-font-family', settings.value.fontFamily)
      }

      if (settings.value.customizeFont !== 'custom'
        && settings.value.customizeFont !== 'recommend'
        && settings.value.customizeFont !== 'recommend-new') {
        document.documentElement.style.removeProperty('--bew-font-family')
      }
    },
    { immediate: true },
  )
}
