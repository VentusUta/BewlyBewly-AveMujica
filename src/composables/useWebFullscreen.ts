import { isInIframe, isVideoOrBangumiPage, queryDomUntilFound } from '~/utils/main'

/**
 * Detect Bilibili web fullscreen (网页全屏) on video/bangumi pages.
 *
 * On normal video pages Bilibili's web-fullscreen player layer happens to cover our overlay
 * (top bar, dock, side buttons), but on bangumi pages (`/bangumi/play/`) it doesn't, leaving
 * them floating over the video. So we explicitly detect web fullscreen by observing the player's
 * web-fullscreen control button toggling `bpx-state-entered`, and let callers hide their overlay.
 *
 * Only active on video/bangumi pages outside of an iframe. (The drawer/iframe case is handled
 * separately in App.vue, which needs to message the parent frame instead.)
 *
 * @returns `isWebFullscreen` — a reactive ref that is `true` while in web fullscreen.
 */
export function useWebFullscreen() {
  const isWebFullscreen = ref<boolean>(false)

  let observer: MutationObserver | null = null
  const abort = new AbortController()

  onMounted(() => {
    if (isInIframe() || !isVideoOrBangumiPage())
      return

    queryDomUntilFound('.bpx-player-ctrl-btn.bpx-player-ctrl-web', 500, abort).then((webFullscreenBtn) => {
      if (!webFullscreenBtn)
        return

      const sync = () => {
        isWebFullscreen.value = webFullscreenBtn.classList.contains('bpx-state-entered')
      }
      sync()
      observer = new MutationObserver(sync)
      observer.observe(webFullscreenBtn, { attributes: true, attributeFilter: ['class'] })
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    abort.abort()
  })

  return { isWebFullscreen }
}
