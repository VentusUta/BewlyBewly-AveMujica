const isArray = val => Array.isArray(val)
function injectFunction(
  origin,
  keys,
  cb,
) {
  if (!isArray(keys))
    keys = [keys]

  const originKeysValue = keys.reduce((obj, key) => {
    obj[key] = origin[key]
    return obj
  }, {})

  keys.map(k => origin[k])

  keys.forEach((key) => {
    const fn = (...args) => {
      cb(...args)
      return (originKeysValue[key]).apply(origin, args)
    }
    fn.toString = (origin)[key].toString
    ;(origin)[key] = fn
  })

  return {
    originKeysValue,
    restore: () => {
      for (const key in originKeysValue) {
        origin[key] = (originKeysValue[key]).bind(origin)
      }
    },
  }
}

// 注入 history.pushState 调用以触发自定义的 pushstate 事件，用于监控 iframe drawer 路由变化
injectFunction(
  window.history,
  ['pushState'],
  (...args) => {
    window.dispatchEvent(new CustomEvent('pushstate', { detail: args }))
  },
)

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

function cleanUrl(url) {
  try {
    const urlObj = new URL(url)
    let hasChanged = false

    PARAMS_TO_REMOVE.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param)
        hasChanged = true
      }
    })

    if (hasChanged) {
      return urlObj.toString()
        .replace(/([^:])\/\//g, '$1/')
        .replace(/%3D/gi, '=')
        .replace(/%26/g, '&')
    }
  }
  catch {
  }
  return url
}

function cleanText(text) {
  if (!text)
    return text
  // 匹配 http/https 链接
  return text.replace(/(https?:\/\/\S+)/g, (match) => {
    return cleanUrl(match)
  })
}

function setupClipboardInterceptor() {
  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard)

  navigator.clipboard.writeText = function (text) {
    const shouldClean = document.documentElement.getAttribute('data-bewly-clean-url') === 'true'
    if (shouldClean && typeof text === 'string' && text.includes('bilibili.com')) {
      text = cleanText(text)
    }
    return originalWriteText(text)
  }
}

setupClipboardInterceptor()

function isReplyActionUrl(url) {
  if (!url)
    return false
  try {
    const parsed = new URL(url, location.href)
    const path = parsed.pathname.replace(/\/+$/, '')
    return parsed.hostname === 'api.bilibili.com'
      && path === '/x/v2/reply/action'
  }
  catch {
    return /api\.bilibili\.com\/x\/v2\/reply\/action(?:\?|$|\/)/.test(String(url))
  }
}

let lastReplyActionToastKey = ''
let lastReplyActionToastAt = 0

function notifyReplyActionError(data) {
  if (!data || typeof data !== 'object')
    return
  if (data.code === 0 || data.code === '0')
    return

  const message = data.message || data.msg
  if (!message || message === '0')
    return

  const text = String(message)
  const now = Date.now()
  if (text === lastReplyActionToastKey && now - lastReplyActionToastAt < 800)
    return
  lastReplyActionToastKey = text
  lastReplyActionToastAt = now

  window.dispatchEvent(new CustomEvent('bewlyApiToast', {
    detail: { message: text, type: 'error' },
  }))
}

function setupReplyActionInterceptor() {
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window)
    window.fetch = function (...args) {
      const input = args[0]
      let url = ''
      if (typeof input === 'string')
        url = input
      else if (input && typeof input.url === 'string')
        url = input.url

      return originalFetch(...args).then((response) => {
        if (isReplyActionUrl(url)) {
          response.clone().json().then(notifyReplyActionError).catch(() => {})
        }
        return response
      })
    }
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__bewlyReplyActionUrl = typeof url === 'string' ? url : String(url ?? '')
      return originalOpen.call(this, method, url, ...rest)
    }

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', function onLoad() {
        if (!isReplyActionUrl(this.__bewlyReplyActionUrl))
          return
        try {
          notifyReplyActionError(JSON.parse(this.responseText))
        }
        catch {}
      })
      return originalSend.apply(this, args)
    }
  }
}

setupReplyActionInterceptor()

// 内容翻译：评论和弹幕请求交给 content script 改写成请求官方译文（必要时重新签名），没有回应时照常请求
let rewrittenBiliRequestUrl = ''
window.addEventListener('bewly:bili-request-rewritten', (event) => {
  rewrittenBiliRequestUrl = typeof event.detail === 'string' ? event.detail : ''
})

function rewriteBiliRequestUrl(url) {
  if (!/api\.bilibili\.com\/x\/v2\/(?:reply|dm)\//.test(url))
    return ''
  // 事件同步派发，content script 的回应在 dispatchEvent 返回前就已到达
  rewrittenBiliRequestUrl = ''
  try {
    window.dispatchEvent(new CustomEvent('bewly:rewrite-bili-request', { detail: new URL(url, location.href).href }))
  }
  catch {
    return ''
  }
  return rewrittenBiliRequestUrl
}

function setupBiliTranslationInterceptor() {
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window)
    window.fetch = function (input, init) {
      let url = ''
      if (typeof input === 'string')
        url = input
      else if (input && typeof input.url === 'string')
        url = input.url
      else if (input instanceof URL)
        url = input.href

      const rewrittenUrl = rewriteBiliRequestUrl(url)
      if (!rewrittenUrl)
        return originalFetch(input, init)

      const request = input instanceof Request ? new Request(rewrittenUrl, input) : rewrittenUrl
      return originalFetch(request, init).then(async (response) => {
        // 改写后的请求被拒（如签名失效）时退回原请求
        try {
          const data = await response.clone().json()
          if (data?.code === -403 || data?.code === -352)
            return originalFetch(input, init)
        }
        catch {}
        return response
      })
    }
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const originalOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      const rewrittenUrl = rewriteBiliRequestUrl(String(url ?? ''))
      return originalOpen.call(this, method, rewrittenUrl || url, ...rest)
    }
  }
}

setupBiliTranslationInterceptor()

// 评论区 IP 属地：接口会返回 reply_control.location，但B站网页端不渲染，这里补到发布时间后面
// 显隐由 content script 设置的 CSS 变量控制，自定义属性能穿透 shadow DOM
const COMMENT_ACTION_BUTTONS_TAG = 'bili-comment-action-buttons-renderer'

function renderCommentIpLocation(el) {
  const pubdateEl = el.shadowRoot?.querySelector('#pubdate')
  if (!pubdateEl)
    return

  let ipLocationEl = el.shadowRoot.querySelector('#bewly-ip-location')
  const ipLocation = el.data?.reply_control?.location
  if (!ipLocation) {
    ipLocationEl?.remove()
    return
  }

  if (!ipLocationEl) {
    ipLocationEl = document.createElement('div')
    ipLocationEl.id = 'bewly-ip-location'
    ipLocationEl.style.display = 'var(--bew-comment-ip-location-display, none)'
    pubdateEl.after(ipLocationEl)
  }
  ipLocationEl.textContent = ipLocation
}

function patchCommentActionButtons(ctor) {
  const originalUpdate = ctor.prototype.update
  ctor.prototype.update = function (...args) {
    const result = originalUpdate.apply(this, args)
    try {
      renderCommentIpLocation(this)
    }
    catch {}
    return result
  }
}

function setupCommentIpLocation() {
  const originalDefine = customElements.define.bind(customElements)
  customElements.define = function (name, ctor, ...rest) {
    if (name === COMMENT_ACTION_BUTTONS_TAG && typeof ctor === 'function')
      patchCommentActionButtons(ctor)
    return originalDefine(name, ctor, ...rest)
  }
}

setupCommentIpLocation()

window.___inject = true

// History.prototype.pushState = history.pushState
// History.prototype.replaceState = history.replaceState
// History.prototype.forward = history.forward
