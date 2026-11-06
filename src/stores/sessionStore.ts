import { defineStore } from 'pinia'

import type { UserInfo } from '~/models/user/userInfo'
import api from '~/utils/api'
import { revokeAccessKey } from '~/utils/authProvider'
import { getCSRF } from '~/utils/main'

export type SessionStatus = 'unknown' | 'loggedIn' | 'loggedOut'

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('unknown')
  const userInfo = ref<UserInfo>()
  let userInfoRequest: Promise<void> | undefined

  async function getUserInfo() {
    if (status.value === 'loggedIn')
      return
    if (userInfoRequest)
      return userInfoRequest

    userInfoRequest = (async () => {
      try {
        const res = await api.user.getUserInfo()

        if (res.code === 0) {
          userInfo.value = res.data
          status.value = 'loggedIn'
        }
        else if (res.code === -101) {
          userInfo.value = undefined
          status.value = 'loggedOut'
        }
      }
      catch (error) {
        userInfo.value = undefined
        status.value = 'loggedOut'
        console.error(error)
      }
    })()

    try {
      await userInfoRequest
    }
    finally {
      userInfoRequest = undefined
    }
  }

  async function logout() {
    revokeAccessKey()
    await api.auth.logout({ biliCSRF: getCSRF() })
    userInfo.value = undefined
    status.value = 'loggedOut'
  }

  return { status, userInfo, getUserInfo, logout }
})
