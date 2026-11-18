import { isInIframe, isLivePage, isVideoOrBangumiPage, queryDomUntilFound } from '~/utils/main'

/**
 * Detect Bilibili web fullscreen (网页全屏) on video/bangumi and live pages.
 *
 * On normal video pages Bilibili's web-fullscreen player layer happens to cover our overlay
 * (top bar, dock, side buttons), but on bangumi pages (`/bangumi/play/`) it doesn't, leaving
 * them floating over the video. So we explicitly detect web fullscreen by observing the player's
 * web-fullscreen control button toggling `bpx-state-entered`, or `player-full-win` on
 * `document.body` on live pages, and let callers hide their overlay.
 *
 * Only active outside of an iframe. (The drawer/iframe case is handled separately in App.vue,
 * which needs to message the parent frame instead.)
 *
 * @returns `isWebFullscreen` — a reactive ref that is `true` while in web fullscreen.
 */
export function useWebFullscreen() {
  const isWebFullscreen = ref<boolean>(false)

  let observer: MutationObserver | null = null
  const abort = new AbortController()

  function observeClass(target: Element, isActive: () => boolean) {
    const sync = () => {
      isWebFullscreen.value = isActive()
    }
    sync()
    observer = new MutationObserver(sync)
    observer.observe(target, { attributes: true, attributeFilter: ['class'] })
  }

  onMounted(() => {
    if (isInIframe())
      return

    if (isLivePage()) {
      observeClass(document.body, () => document.body.classList.contains('player-full-win'))
      return
    }

    if (!isVideoOrBangumiPage())
      return

    queryDomUntilFound('.bpx-player-ctrl-btn.bpx-player-ctrl-web', 500, abort).then((webFullscreenBtn) => {
      if (!webFullscreenBtn)
        return

      observeClass(webFullscreenBtn, () => webFullscreenBtn.classList.contains('bpx-state-entered'))
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    abort.abort()
  })

  return { isWebFullscreen }
}
