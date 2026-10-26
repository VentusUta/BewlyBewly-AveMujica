import type { Runtime } from 'webextension-polyfill'

import type { API_COLLECTION } from '~/background/messageListeners/api'

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
                return sendToBackground({
                  contentScriptQuery: p,
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
