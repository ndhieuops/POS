import { vi } from "../i18n/vi"
import "./Keypad.css"

interface Props {
  onDigit: (d: string) => void
  onBackspace: () => void
}

export function Keypad({ onDigit, onBackspace }: Props) {
  return (
    <div className="keypad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
        <button key={d} type="button" className="keypad-key" onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <button type="button" className="keypad-key keypad-back" onClick={onBackspace}>
        {vi.backspace}
      </button>
    </div>
  )
}
