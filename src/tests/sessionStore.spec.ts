import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '../stores/sessionStore'

const { getUserInfo, logout, revokeAccessKey } = vi.hoisted(() => ({
  getUserInfo: vi.fn(),
  logout: vi.fn(),
  revokeAccessKey: vi.fn(),
}))

vi.mock('~/utils/api', () => ({
  default: {
    user: { getUserInfo },
    auth: { logout },
  },
}))

vi.mock('~/utils/authProvider', () => ({ revokeAccessKey }))
vi.mock('~/utils/main', () => ({ getCSRF: () => 'csrf-token' }))

describe('sessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getUserInfo.mockReset()
    logout.mockReset()
    revokeAccessKey.mockReset()
  })

  it('loads user info once and shares concurrent requests', async () => {
    let resolveRequest!: (value: { code: number, data: { mid: number } }) => void
    getUserInfo.mockReturnValue(new Promise(resolve => resolveRequest = resolve))
    const session = useSessionStore()

    const firstRequest = session.getUserInfo()
    const secondRequest = session.getUserInfo()
    expect(getUserInfo).toHaveBeenCalledTimes(1)

    resolveRequest({ code: 0, data: { mid: 42 } })
    await Promise.all([firstRequest, secondRequest])

    expect(session.status).toBe('loggedIn')
    expect(session.userInfo?.mid).toBe(42)

    await session.getUserInfo()
    expect(getUserInfo).toHaveBeenCalledTimes(1)
  })

  it('marks the session as logged out when the account is not logged in', async () => {
    getUserInfo.mockResolvedValue({ code: -101 })
    const session = useSessionStore()

    await session.getUserInfo()

    expect(session.status).toBe('loggedOut')
    expect(session.userInfo).toBeUndefined()
  })

  it('marks the session as logged out when loading user info fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    getUserInfo.mockRejectedValue(new Error('network'))
    const session = useSessionStore()

    await session.getUserInfo()

    expect(session.status).toBe('loggedOut')
    expect(session.userInfo).toBeUndefined()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('revokes local authorization and clears the session after logout', async () => {
    getUserInfo.mockResolvedValue({ code: 0, data: { mid: 42 } })
    logout.mockResolvedValue({ code: 0 })
    const session = useSessionStore()
    await session.getUserInfo()

    await session.logout()

    expect(revokeAccessKey).toHaveBeenCalledTimes(1)
    expect(logout).toHaveBeenCalledWith({ biliCSRF: 'csrf-token' })
    expect(session.status).toBe('loggedOut')
    expect(session.userInfo).toBeUndefined()
  })
})
