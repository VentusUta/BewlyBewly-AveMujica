import type { Runtime } from 'webextension-polyfill'

import type { API_COLLECTION } from '~/background/messageListeners/api'
import { FullAPI } from '~/background/messageListeners/api'
import type { API, Message } from '~/background/utils'
import { buildRequest, sendResponseHandler } from '~/background/utils'

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : Lowercase<S>

type APIFunction<T = typeof API_COLLECTION> = {
  [K in keyof T as CamelCase<string & K>]: {
    // @ts-expect-error allow params
    [P in keyof T[K]]: T[K][P] extends (...args: never) => unknown ? T[K][P] : Lowercase<T[K][P]['_fetch']['method']> extends 'get' ? (options?: Partial<T[K][P]['params']>) => Promise<any> : (options?: Partial<T[K][P]['params'] & T[K][P]['_fetch']['body']>) => Promise<any>
  }
}

// 1.8.33 及更早版本的后台要有端口连入才注册 onMessage，Chrome 更新扩展后可能仍在运行它
// https://github.com/VentusUta/BewlyBewly-AveMujica/issues/129
let oldBackgroundPort: Runtime.Port | undefined

function connectOldBackground() {
  if (oldBackgroundPort)
    return
  const port = browser.runtime.connect()
  oldBackgroundPort = port
  port.onDisconnect.addListener(() => {
    void browser.runtime.lastError
    oldBackgroundPort = undefined
  })
}

async function sendToBackground(message: object) {
  try {
    return await browser.runtime.sendMessage(message)
  }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes('Receiving end does not exist'))
      throw error
    connectOldBackground()
    return browser.runtime.sendMessage(message)
  }
}

// POST 由内容脚本以页面身份发送：带扩展 Origin 的 POST 会被B站风控拦下，而 Safari 不改写扩展自己发出的请求头
function getPagePostApi(query: string) {
  if (!/^https?:$/.test(location.protocol))
    return
  const api = FullAPI[query]
  if (typeof api === 'object' && api._fetch.method.toLowerCase() === 'post')
    return api
}

async function fetchFromPage(message: Message, api: API) {
  const { url, fetchOpt } = buildRequest(message, api)
  const res = await fetch(url, { ...fetchOpt, credentials: 'include' })
  if (!res.ok)
    throw new Error(`HTTP ${res.status}: ${url}`)
  let data: any = res
  for (const handler of api.afterHandle) {
    if (handler as unknown !== sendResponseHandler)
      data = await handler(data)
  }
  return data
}

async function request(message: Message) {
  const pageApi = getPagePostApi(message.contentScriptQuery)
  if (pageApi)
    return fetchFromPage(message, pageApi)

  const res = await sendToBackground(message)
  if (res === undefined)
    throw new Error(`No response from background: ${message.contentScriptQuery}`)
  return res
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export interface APIClient extends APIFunction<typeof API_COLLECTION> {

}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class APIClient {
  private readonly cache = new Map<string | symbol, any>()

  constructor() {
    // @ts-expect-error ignore
    return new Proxy({}, {
      get: (_, namespace) => { // namespace
        if (this.cache.has(namespace)) {
          return this.cache.get(namespace)
        }
        else {
          const api = new Proxy({}, {
            get(_, p) {
              return (options?: object) => {
                return request({
                  contentScriptQuery: p as string,
                  ...options,
                })
              }
            },
          })
          this.cache.set(namespace, api)
          return api
        }
      },
    })
  }
}

const api = new APIClient()

export default api
