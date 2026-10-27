import api from '~/utils/api'
import { getCSRF } from '~/utils/main'
import { signWbiQuery } from '~/utils/wbi'
import { loadWbiMixinKey } from '~/utils/wbiKey'

import type { Author, Video } from './types'

export enum VideoMoreCommand {
  NotInterestedVideo = 1,
  NotInterestedUploader = 2,
  BlockUploader = 3,
}

const WEB_DISLIKE_REASON_IDS = new Map([
  [VideoMoreCommand.NotInterestedVideo, 1],
  [VideoMoreCommand.NotInterestedUploader, 4],
])

export function getWebDislikeReasonId(video: Video, command: VideoMoreCommand) {
  if (video.dislikeSwitch && video.trackId)
    return WEB_DISLIKE_REASON_IDS.get(command)
}

export async function sendWebDislikeFeedback(video: Video, reasonId: number, cancel = false) {
  const mixinKey = await loadWbiMixinKey()
  const wbiParams = mixinKey ? Object.fromEntries(new URLSearchParams(signWbiQuery({}, mixinKey))) : {}
  const params = {
    goto: video.goto,
    id: video.id,
    mid: Array.isArray(video.author) ? video.author[0]?.mid : video.author?.mid,
    track_id: video.trackId,
    reason_id: reasonId,
    csrf: getCSRF(),
    ...wbiParams,
  }
  return cancel ? api.video.undoDislikeWebVideo(params) : api.video.dislikeWebVideo(params)
}

export function getAuthorJumpUrl(author?: Author) {
  if (!author)
    return ''

  return author.authorUrl || (author.mid ? `//space.bilibili.com/${author.mid}` : '')
}

export function getCurrentTime(videoElement: Ref<HTMLVideoElement | null>) {
  if (videoElement.value) {
    return videoElement.value.currentTime
  }
  return null
}

export function getCurrentVideoUrl(video: Video, videoCurrentTime: Ref<number | null>) {
  const baseUrl = `https://www.bilibili.com/video/${video.bvid ?? `av${video.aid}`}`
  const currentTime = videoCurrentTime.value
  return currentTime && currentTime > 5 ? `${baseUrl}/?t=${currentTime}` : baseUrl
}

export function blockUploader(author: number | undefined, csrf: string) {
  const baseUrl = `https://api.bilibili.com/x/relation/modify`
  const Params = new URLSearchParams()
  Params.append('fid', author?.toString() || '')
  Params.append('act', '5')
  Params.append('re_src', '11')
  Params.append('csrf', csrf || '')
  return fetch(baseUrl, {
    method: 'POST',
    body: Params,
    credentials: 'include',
  }).then((res) => {
    if (!res.ok)
      throw new Error(`HTTP error! Status: ${res.status}`)
    return res.json()
  }).then((data) => {
    return data.code === 0
  }).catch(() => {
    return false
  })
}

export function unblockUploader(author: number | undefined, csrf: string) {
  const baseUrl = `https://api.bilibili.com/x/relation/modify`
  const Params = new URLSearchParams()
  Params.append('fid', author?.toString() || '')
  Params.append('act', '6')
  Params.append('re_src', '11')
  Params.append('csrf', csrf || '')
  return fetch(baseUrl, {
    method: 'POST',
    body: Params,
    credentials: 'include',
  }).then((res) => {
    if (!res.ok)
      throw new Error(`HTTP error! Status: ${res.status}`)
    return res.json()
  }).then((data) => {
    return data.code === 0
  }).catch(() => {
    return false
  })
}
