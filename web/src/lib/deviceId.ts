const DEVICE_KEY = "pos_device_id"
const LOGIN_KEY = "pos_login_id"

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

export function getDeviceId(): string | null {
  return read(DEVICE_KEY)
}
export function setDeviceId(id: string): void {
  write(DEVICE_KEY, id)
}
/** Temporary id used for owner PIN login before the device is registered. */
export function getLoginId(): string {
  const existing = read(LOGIN_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  write(LOGIN_KEY, id)
  return id
}
/** Id sent with owner login: the registered device id when present, else the temporary one. */
export function ownerLoginId(): string {
  return getDeviceId() ?? getLoginId()
}
