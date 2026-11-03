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
/**
 * Random UUID-v4 string from crypto.getRandomValues.
 * crypto.randomUUID is only defined in secure contexts (HTTPS or localhost),
 * so it is undefined when the app is opened as http://<LAN IP>:8080.
 */
export function randomId(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
/** Temporary id used for owner PIN login before the device is registered. */
export function getLoginId(): string {
  const existing = read(LOGIN_KEY)
  if (existing) return existing
  const id = randomId()
  write(LOGIN_KEY, id)
  return id
}
/** Id sent with owner login: the registered device id when present, else the temporary one. */
export function ownerLoginId(): string {
  return getDeviceId() ?? getLoginId()
}
