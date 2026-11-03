import { useEffect, useRef, useState } from "react"
import { vi } from "../i18n/vi"
import { formatVnd, thousandsToDong } from "../lib/money"
import { Keypad } from "./Keypad"
import "./CustomPriceDialog.css"

interface Props {
  onAdd: (line: { name: string; unitPrice: number; note: string }) => void
  onClose: () => void
}

export function CustomPriceDialog({ onAdd, onClose }: Props) {
  const [typed, setTyped] = useState("")
  const [note, setNote] = useState("")
  const amountRef = useRef<HTMLDivElement>(null)
  useEffect(() => { amountRef.current?.focus() }, [])
  const amount = thousandsToDong(typed)

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={vi.customPrice}>
      <div className="cpd-card">
        <h2 className="cpd-title">{vi.customPrice}</h2>
        <div className="cpd-label">{vi.amountThousands}</div>
        <div className="cpd-amount" ref={amountRef} tabIndex={-1} data-testid="custom-amount">{formatVnd(amount)}</div>
        <Keypad
          onDigit={(d) => setTyped((t) => (t + d).replace(/^0+/, "").slice(0, 6))}
          onBackspace={() => setTyped((t) => t.slice(0, -1))}
        />
        <input
          className="cpd-note"
          placeholder={vi.note}
          aria-label={vi.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="cpd-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {vi.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={amount <= 0}
            onClick={() => onAdd({ name: note.trim(), unitPrice: amount, note: note.trim() })}
          >
            {vi.addToCart}
          </button>
        </div>
      </div>
    </div>
  )
}
