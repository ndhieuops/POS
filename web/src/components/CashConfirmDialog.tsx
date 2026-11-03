import { useEffect, useRef, useState } from "react"
import { api, ApiError, type SaleOut } from "../api/client"
import { vi } from "../i18n/vi"
import { formatVnd } from "../lib/money"
import "./CashConfirmDialog.css"

interface Props {
  sale: SaleOut
  onPaid: (sale: SaleOut) => void
  onBack: () => void
}

/** Second step of a cash sale: shows the server total; confirms only on an explicit tap. */
export function CashConfirmDialog({ sale, onPaid, onBack }: Props) {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => { primary.current?.focus() }, [])

  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      onPaid(await api.confirm(sale.id, "cash"))
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : vi.networkError)
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={vi.cashTitle}>
      <div className="cash-card">
        <div className="cash-title">{vi.cashTitle}</div>
        <div className="cash-total">{formatVnd(sale.total)}</div>
        {error ? <div className="cash-error" role="alert">{error}</div> : null}
        <button ref={primary} type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => void confirm()}>
          {vi.cashReceived}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBack}>
          {vi.back}
        </button>
      </div>
    </div>
  )
}
