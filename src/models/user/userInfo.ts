// https://github.com/SocialSisterYi/bilibili-API-collect/blob/e379d904c2753fa30e9083f59016f07e89d19467/docs/login/login_info.md#%E5%AF%BC%E8%88%AA%E6%A0%8F%E7%94%A8%E6%88%B7%E4%BF%A1%E6%81%AF
export interface UserInfo {
  face: string // avatar
  level_info: {
    current_level: number
    current_min: number
    current_exp: number
    next_exp: number
  }
  mid: number
  money: number // 硬幣
  uname: string // username
  vip: {
    status: number // 1 is vip
  }
  wallet: {
    mid: number
    bcoin_balance: number // b幣
  }
  is_senior_member: boolean
}
