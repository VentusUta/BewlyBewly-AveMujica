import type { Author, Video } from './types'

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
