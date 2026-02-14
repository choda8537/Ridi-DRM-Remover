export interface UserDevice {
  id: number
  user_idx: number
  device_id: string
  device_code: string
  device_ver: string | null
  device_nick: string
  status: string
  last_used: string
  created: string
  last_modified: string
}

export interface UserDevices {
  user_devices: UserDevice[]
}
