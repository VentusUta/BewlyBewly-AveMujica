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
  'trackid',
  'is_story_h5',
  'share_from',
  'plat_id',
  '-Arouter',
  'launch_id',
  'live_from',
  'hotRank',
  'broadcast_type',
]

/**
 * Clean a URL string by removing tracking and source parameters
 * @param url - The URL string to clean
 * @returns The cleaned URL string
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    PARAMS_TO_REMOVE.forEach((param) => {
      urlObj.searchParams.delete(param)
    })

    return urlObj.toString()
      .replace(/([^:])\/\//g, '$1/')
      .replace(/%3D/gi, '=')
      .replace(/%26/g, '&')
  }
  catch {
    return url
  }
}

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

export function initUrlCleaner() {
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
