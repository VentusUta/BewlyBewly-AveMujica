import api from './api'
import { getWbiMixinKey } from './wbi'

let mixinKeyPromise: Promise<string | null> | null = null

export function loadWbiMixinKey(): Promise<string | null> {
  if (mixinKeyPromise)
    return mixinKeyPromise
  const imgUrl = localStorage.getItem('wbi_img_url')
  const subUrl = localStorage.getItem('wbi_sub_url')
  if (imgUrl && subUrl) {
    mixinKeyPromise = Promise.resolve(getWbiMixinKey(imgUrl, subUrl))
    return mixinKeyPromise
  }
  mixinKeyPromise = api.user.getUserInfo()
    .then((res) => {
      const wbiImg = res?.data?.wbi_img
      return wbiImg ? getWbiMixinKey(wbiImg.img_url, wbiImg.sub_url) : null
    })
    .catch(() => null)
  return mixinKeyPromise
}
