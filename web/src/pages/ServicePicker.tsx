import type { Floor, Service } from "../api/client"
import { vi } from "../i18n/vi"
import "./Form.css"

/** Hour (0-23) in Asia/Ho_Chi_Minh. */
function saigonHour(d: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(d)
  return parseInt(h, 10) % 24
}

/** 18:00-22:00 tea & ice cream, 22:00-02:00 pub, otherwise none. */
export function currentFloor4Service(d: Date): "tea" | "pub" | null {
  const h = saigonHour(d)
  if (h >= 18 && h < 22) return "tea"
  if (h >= 22 || h < 2) return "pub"
  return null
}

interface Props {
  floor: Floor
  onPick: (s: Service) => void
  now?: () => Date
}

export function ServicePicker({ floor, onPick, now = () => new Date() }: Props) {
  const hl = floor === "floor4" ? currentFloor4Service(now()) : null
  const items: { s: Service; label: string }[] =
    floor === "floor1"
      ? [{ s: "grocery", label: vi.grocery }]
      : [{ s: "tea", label: vi.teaIceCream }, { s: "pub", label: vi.pub }]
  return (
    <div className="form-page picker">
      <h1>{vi.chooseService}</h1>
      {items.map(({ s, label }) => (
        <button key={s} type="button" className="btn btn-secondary" aria-current={hl === s ? "true" : undefined} onClick={() => onPick(s)}>
          {label}
        </button>
      ))}
    </div>
  )
}
