import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FullAPI } from '../background/messageListeners/api'
import type { API } from '../background/utils'
import { buildRequest, sendResponseHandler } from '../background/utils'
import api from '../utils/api'

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }))

vi.mock('webextension-polyfill', () => ({
  default: { runtime: { id: 'test-extension-id', sendMessage } },
}))

describe('buildRequest', () => {
  it('puts fields declared in the POST body into a form body and the rest into the query', () => {
    const { url, fetchOpt } = buildRequest(
      { contentScriptQuery: 'removeFromWatchLater', aid: 1, csrf: 'token' },
      FullAPI.removeFromWatchLater as API,
    )
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview/del?aid=1')
    expect(fetchOpt.method).toBe('post')
    expect(String((fetchOpt as { body?: unknown }).body)).toBe('viewed=false&csrf=token')
  })

  it('sends GET without a body', () => {
    const { url, fetchOpt } = buildRequest(
      { contentScriptQuery: 'getAllWatchLaterList' },
      FullAPI.getAllWatchLaterList as API,
    )
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview')
    expect(fetchOpt).not.toHaveProperty('body')
  })
})

describe('sendResponseHandler', () => {
  it('passes the data on after sending it', () => {
    const sendResponse = vi.fn()
    expect(sendResponseHandler(sendResponse)({ code: 0 })).toEqual({ code: 0 })
    expect(sendResponse).toHaveBeenCalledWith({ code: 0 })
  })
})

describe('api client', () => {
  const fetch = vi.fn<typeof globalThis.fetch>()

  beforeEach(() => {
    sendMessage.mockReset()
    fetch.mockReset()
    vi.stubGlobal('fetch', fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends POST from the page with its cookies instead of through the background', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ code: 0 })))
    await expect(api.watchlater.saveToWatchLater({ aid: 1, csrf: 'token' })).resolves.toEqual({ code: 0 })

    expect(sendMessage).not.toHaveBeenCalled()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.bilibili.com/x/v2/history/toview/add')
    expect(init).toMatchObject({ method: 'post', credentials: 'include' })
    expect(String(init?.body)).toBe('aid=1&csrf=token')
  })

  it('rejects a POST that bilibili turns away', async () => {
    fetch.mockResolvedValue(new Response('<html></html>', { status: 412 }))
    await expect(api.watchlater.saveToWatchLater({ aid: 1, csrf: 'token' })).rejects.toThrow('HTTP 412')
  })

  it('returns what the background sends back for GET', async () => {
    sendMessage.mockResolvedValue({ code: 0 })
    await expect(api.watchlater.getAllWatchLaterList()).resolves.toEqual({ code: 0 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects instead of resolving undefined when the background sends nothing back', async () => {
    await expect(api.watchlater.getAllWatchLaterList()).rejects.toThrow('No response from background: getAllWatchLaterList')
  })
})
