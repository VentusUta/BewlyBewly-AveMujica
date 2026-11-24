export interface WebAreaListResult {
  code: number
  message: string
  ttl?: number
  data: WebAreaListData
}

export interface WebAreaListData {
  data: LiveParentArea[]
}

export interface LiveParentArea {
  id: number
  name: string
  parent_area_type?: number
  list: LiveSubArea[]
}

export interface LiveSubArea {
  id: string | number
  parent_id: string | number
  old_area_id?: string | number
  name: string
  act_id?: string
  pk_status?: string
  hot_status?: number
  lock_status?: string
  pic: string
  complex_area_name?: string
  parent_name?: string
  area_type?: number
  cate_id?: string
}
