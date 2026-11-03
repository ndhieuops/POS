import { useCallback, useEffect, useRef, useState } from "react"
import { api, ApiError, type ProductOut, type SaleLineIn, type SaleOut } from "../api/client"
import { CustomPriceDialog } from "../components/CustomPriceDialog"
import { QrPaymentModal } from "../components/QrPaymentModal"
import { useBarcodeScanner } from "../hooks/useBarcodeScanner"
import { vi } from "../i18n/vi"
import { formatVnd } from "../lib/money"
import "./GroceryCheckout.css"

interface CartLine extends SaleLineIn {
  key: number
  product_id: number | null
  note: string | null
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.detail : vi.networkError
}
function pendingFrom(e: unknown): SaleOut | null {
  if (e instanceof ApiError && e.status === 409) {
    const s = (e.body as { sale?: SaleOut } | null)?.sale
    return s ?? null
  }
  return null
}

export function GroceryCheckout({ deviceId }: { deviceId: string }) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [modalSale, setModalSale] = useState<SaleOut | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState("")
  const nextKey = useRef(1)
  const busyRef = useRef(false)

  useEffect(() => {
    let alive = true
    api.pendingSale(deviceId).then(
      (s) => { if (alive && s) setModalSale(s) },
      () => {},
    )
    return () => { alive = false }
  }, [deviceId])

  const addProduct = useCallback((p: ProductOut) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.product_id === p.id)
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, qty_milli: l.qty_milli + 1000 } : l))
      return [...c, {
        key: nextKey.current++, product_id: p.id, name: p.name, unit: p.unit,
        qty_milli: 1000, unit_price: p.sell_price, note: null,
      }]
    })
  }, [])

  const handleCode = useCallback(async (raw: string) => {
    const code = raw.trim()
    setManual("")
    if (!code) return
    setError(null)
    setNotFound(false)
    try {
      addProduct(await api.lookupBarcode(code))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true)
      else setError(errMsg(e))
    }
  }, [addProduct])

  const locked = modalSale !== null || customOpen
  useBarcodeScanner(handleCode, !locked)

  const total = cart.reduce((s, l) => s + Math.round((l.qty_milli * l.unit_price) / 1000), 0)

  function changeQty(key: number, delta: number) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, qty_milli: Math.max(1000, l.qty_milli + delta) } : l)))
  }
  function remove(key: number) {
    setCart((c) => c.filter((l) => l.key !== key))
  }

  async function pay(kind: "qr" | "cash") {
    if (busyRef.current || cart.length === 0) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const lines: SaleLineIn[] = cart.map(({ key: _k, ...l }) => l)
      const sale = await api.createSale({ device_id: deviceId, service: "grocery", lines })
      if (kind === "qr") {
        setModalSale(await api.requestQr(sale.id))
      } else {
        await api.confirm(sale.id, "cash")
        setCart([])
      }
    } catch (e) {
      const pending = pendingFrom(e)
      if (pending) setModalSale(pending)
      else setError(errMsg(e))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const empty = cart.length === 0

  return (
    <div className="gc">
      <main className="gc-main">
        <form
          className="gc-scan"
          onSubmit={(e) => { e.preventDefault(); void handleCode(manual) }}
        >
          <input
            className="gc-input"
            aria-label={vi.barcodeInput}
            placeholder={vi.scanOrType}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            disabled={locked}
          />
        </form>
        {notFound ? (
          <div className="gc-notfound" role="alert">
            <span>{vi.notFound}</span>
            <button type="button" className="btn btn-secondary" onClick={() => { setCustomOpen(true) }}>
              {vi.addCustomPrice}
            </button>
          </div>
        ) : null}
        {error ? <div className="gc-error" role="alert">{error}</div> : null}
        <ul className="gc-lines" aria-label={vi.cartTitle}>
          {empty ? <li className="gc-empty">{vi.emptyCart}</li> : null}
          {cart.map((l) => (
            <li key={l.key} className="gc-line" data-testid="cart-line">
              <div className="gc-name">{l.name}</div>
              <div className="gc-price">{formatVnd(l.unit_price)}</div>
              <div className="gc-qty">
                <button type="button" className="btn btn-secondary btn-sq" aria-label={vi.decrease}
                  disabled={l.qty_milli <= 1000} onClick={() => changeQty(l.key, -1000)}>−</button>
                <span className="gc-qty-n" data-testid="qty">{l.qty_milli / 1000}</span>
                <button type="button" className="btn btn-secondary btn-sq" aria-label={vi.increase}
                  onClick={() => changeQty(l.key, 1000)}>+</button>
              </div>
              <button type="button" className="btn btn-danger" onClick={() => remove(l.key)}>{vi.remove}</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary" onClick={() => setCustomOpen(true)}>
          {vi.customPrice}
        </button>
      </main>
      <aside className="gc-side">
        <div className="gc-total-label">{vi.total}</div>
        <div className="gc-total">{formatVnd(total)}</div>
        <button type="button" className="btn btn-primary btn-big" disabled={empty || busy} onClick={() => void pay("qr")}>
          {vi.payQr}
        </button>
        <button type="button" className="btn btn-secondary btn-big" disabled={empty || busy} onClick={() => void pay("cash")}>
          {vi.payCash}
        </button>
        {busy ? <div className="gc-wait">{vi.pleaseWait}</div> : null}
      </aside>
      {customOpen ? (
        <CustomPriceDialog
          onClose={() => setCustomOpen(false)}
          onAdd={({ name, unitPrice, note }) => {
            setCart((c) => [...c, {
              key: nextKey.current++, product_id: null, name: name || vi.customPrice,
              unit: "cái", qty_milli: 1000, unit_price: unitPrice, note: note || null,
            }])
            setCustomOpen(false)
            setNotFound(false)
          }}
        />
      ) : null}
      {modalSale ? (
        <QrPaymentModal
          sale={modalSale}
          onPaid={() => { setModalSale(null); setCart([]) }}
        />
      ) : null}
    </div>
  )
}
