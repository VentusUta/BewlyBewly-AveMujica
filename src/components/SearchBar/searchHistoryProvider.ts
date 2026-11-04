const SEARCH_HISTORY_LIMIT = 20

export interface HistoryItem {
  value: string
  timestamp: number
}
export interface SuggestionItem {
  value: string
  term: string
  name: string
  type: string
  ref: number
  spid: number
  timestamp: number
}
export interface SuggestionResponse {
  code: number
  exp_str: string
  result: {
    tag: SuggestionItem[]
  }
  stoken: string
}

interface HistoryStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}

const NAMESPACE = 'search_history'
const HISTORY_KEY = 'search_history'

const COLS_ORIGIN = 'https://s1.hdslb.com'
const COLS_SRC = `${COLS_ORIGIN}/bfs/seed/jinkela/short/cols/iframe.html`
const COLS_TIMEOUT = 3000

async function getColsFrame(): Promise<HTMLIFrameElement> {
  let iframe = document.querySelector<HTMLIFrameElement>(`iframe[src="${COLS_SRC}"]`)
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.src = COLS_SRC
    iframe.style.display = 'none'
    iframe.dataset.count = '1'
    document.body.appendChild(iframe)
  }
  if (!iframe.dataset.loaded) {
    await new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }))
    iframe.dataset.loaded = 'true'
  }
  return iframe
}

async function colsRequest(type: 'COLS_GET' | 'COLS_SET', key: string, value?: string): Promise<string | null> {
  const id = crypto.randomUUID()
  const controller = new AbortController()
  const { promise: timeout, reject } = Promise.withResolvers<never>()
  const timer = setTimeout(() => reject(new Error(`COLS: ${type} ${key} timed out`)), COLS_TIMEOUT)

  try {
    const response = new Promise<string | null>((resolve) => {
      window.addEventListener('message', (e: MessageEvent) => {
        if (e.origin === COLS_ORIGIN && e.data?.type === 'COLS_RES' && e.data.id === id)
          resolve(e.data.value ?? null)
      }, { signal: controller.signal })
    })
    const iframe = await Promise.race([getColsFrame(), timeout])
    iframe.contentWindow!.postMessage({ type, key, value, id }, COLS_ORIGIN)
    return await Promise.race([response, timeout])
  }
  finally {
    clearTimeout(timer)
    controller.abort()
  }
}

// 与B站一致：Safari 下不用跨域 iframe，直接存在当前域名的 localStorage
const storage: HistoryStorage = /apple/i.test(navigator.vendor)
  ? {
      getItem: async key => localStorage.getItem(`${NAMESPACE}:${key}`),
      setItem: async (key, value) => localStorage.setItem(`${NAMESPACE}:${key}`, value),
    }
  : {
      getItem: key => colsRequest('COLS_GET', `${NAMESPACE}:${key}`),
      setItem: async (key, value) => {
        await colsRequest('COLS_SET', `${NAMESPACE}:${key}`, value)
      },
    }

async function readHistory(): Promise<HistoryItem[]> {
  const raw = await storage.getItem(HISTORY_KEY)
  try {
    const history = JSON.parse(raw ?? '[]')
    return Array.isArray(history) ? history : []
  }
  catch {
    return []
  }
}

async function writeHistory(history: HistoryItem[]) {
  await storage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

export async function getSearchHistory(): Promise<HistoryItem[]> {
  try {
    return (await readHistory()).sort((a, b) => b.timestamp - a.timestamp)
  }
  catch (error) {
    console.error(error)
    return []
  }
}

export async function addSearchHistory(historyItem: HistoryItem) {
  const history = (await readHistory()).filter(item => item.value !== historyItem.value)
  history.unshift(historyItem)
  return writeHistory(history.slice(0, SEARCH_HISTORY_LIMIT))
}

export async function removeSearchHistory(value: string) {
  return writeHistory((await readHistory()).filter(item => item.value !== value))
}

export async function clearAllSearchHistory() {
  return writeHistory([])
}
