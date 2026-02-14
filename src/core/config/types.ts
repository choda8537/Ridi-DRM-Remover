export interface UserData {
  id: string
  user_idx: string
  device_id: string
  device_name: string | null
}

export interface ConfigData {
  users: UserData[]
  active_user: string | null
}
