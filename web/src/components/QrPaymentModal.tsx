import { useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { api, ApiError, type SaleOut } from "../api/client"
import { vi } from "../i18n/vi"
import { formatVnd } from "../lib/money"
import "./CustomPriceDialog.css"
import "./QrPaymentModal.css"

interface Props {
  sale: SaleOut
  onPaid: (sale: SaleOut) => void
}

/** Locked payment screen: no close/cancel; leaves only via confirm. */
export function QrPaymentModal({ sale, onPaid }: Props) {
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(method: "bank_qr" | "cash") {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const paid = await api.confirm(sale.id, method)
      onPaid(paid)
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : vi.networkError)
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={vi.payQr}>
      <div className="qr-card">
        <div className="qr-total">{formatVnd(sale.total)}</div>
        {sale.qr_payload ? (
          <div className="qr-code" role="img" aria-label={vi.qrCodeLabel}>
            <QRCodeSVG value={sale.qr_payload} size={260} marginSize={2} />
          </div>
        ) : null}
        <div className="qr-waiting">{vi.waitingTransfer}</div>
        {error ? <div className="qr-error" role="alert">{error}</div> : null}
        <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => confirm("bank_qr")}>
          {vi.moneyReceived}
        </button>
        <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => confirm("cash")}>
          {vi.payCashSmall}
        </button>
        <div className="qr-paused">{vi.scannerPaused}</div>
      </div>
    </div>
  )
}
