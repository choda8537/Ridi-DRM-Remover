import { homedir } from 'os'
import { join } from 'path'

export const RIDI_LOGIN_URL = 'https://ridibooks.com/account/login'
export const RIDI_USER_DEVICES_API =
  'https://account.ridibooks.com/api/user-devices/app'

export const RIDI_KEYCHAIN_SERVICE = 'com.ridi.books'
export const RIDI_KEYCHAIN_ACCOUNT = 'global'
export const RIDI_SETTINGS_PAYLOAD_OFFSET = 256

export const RIDI_OAUTH_CLIENT_ID = process.env.RIDI_OAUTH_CLIENT_ID || ''
export const RIDI_OAUTH_CLIENT_SECRET =
  process.env.RIDI_OAUTH_CLIENT_SECRET || ''
export const RIDI_OAUTH_TOKEN_API = 'https://account.ridibooks.com/oauth2/token'

export const CONFIG_FILE = join(homedir(), '.ridi_auth.json')
