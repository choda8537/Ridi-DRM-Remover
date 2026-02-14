import { join } from 'path'
import { homedir } from 'os'

export const RIDI_LOGIN_URL = 'https://ridibooks.com/account/login'
export const RIDI_USER_DEVICES_API =
  'https://account.ridibooks.com/api/user-devices/app'
export const CONFIG_FILE = join(homedir(), '.ridi_auth.json')
