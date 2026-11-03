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
  const [pendingReady, setPendingReady] = useState(false)
  const nextKey = useRef(1)
  // Keys of cart lines sent with the sale shown in the modal; null when the modal is for a foreign (earlier) sale.
  const sentKeys = useRef<Set<number> | null>(null)
  // Sale created by us whose QR request may have been lost; a 409 for the same id is our own sale.
  const created = useRef<{ id: number; keys: Set<number> } | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    let alive = true
    const check = (retry: boolean) => {
      api.pendingSale(deviceId).then(
        (s) => {
          if (!alive) return
          setError(null)
          if (s) { sentKeys.current = null; setModalSale(s) }
          setPendingReady(true)
        },
        (e) => {
          if (!alive) return
          setError(errMsg(e))
          if (retry) check(false)
          else setPendingReady(true)
        },
      )
    }
    check(true)
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

  const dialogOpen = modalSale !== null || customOpen
  const locked = dialogOpen || busy || !pendingReady
  useBarcodeScanner(handleCode, !locked)

  // While a dialog is open, Enter (e.g. a scanner's terminator) must not activate anything behind it.
  useEffect(() => {
    if (!dialogOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return
      // Only the custom-price note input may take Enter; keypad digits must not be re-pressed.
      const inNote = modalSale === null && e.target instanceof HTMLInputElement
      if (!inNote) e.preventDefault()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [dialogOpen, modalSale])

  function clearSent() {
    const sent = sentKeys.current
    sentKeys.current = null
    created.current = null
    if (sent) setCart((c) => c.filter((l) => !sent.has(l.key)))
  }

  const total = cart.reduce((s, l) => s + Math.round((l.qty_milli * l.unit_price) / 1000), 0)

  function changeQty(key: number, delta: number) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, qty_milli: Math.max(1000, l.qty_milli + delta) } : l)))
  }
  function remove(key: number) {
    setCart((c) => c.filter((l) => l.key !== key))
  }

  async function pay(kind: "qr" | "cash") {
    if (busyRef.current || cart.length === 0 || !pendingReady) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const lines: SaleLineIn[] = cart.map(({ key: _k, ...l }) => l)
      const keys = new Set(cart.map((l) => l.key))
      sentKeys.current = keys
      const sale = await api.createSale({ device_id: deviceId, service: "grocery", lines })
      created.current = { id: sale.id, keys }
      if (kind === "qr") {
        setModalSale(await api.requestQr(sale.id))
      } else {
        await api.confirm(sale.id, "cash")
        clearSent()
      }
    } catch (e) {
      const pending = pendingFrom(e)
      if (pending) {
        const own = created.current !== null && created.current.id === pending.id
        sentKeys.current = own ? created.current!.keys : null
        setModalSale(pending)
      }
      else setError(errMsg(e))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const empty = cart.length === 0

  return (
    <div className="gc">
      <main className="gc-main" inert={dialogOpen}>
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
            <button type="button" className="btn btn-secondary" disabled={locked} onClick={() => { setCustomOpen(true) }}>
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
                  disabled={locked || l.qty_milli <= 1000} onClick={() => changeQty(l.key, -1000)}>−</button>
                <span className="gc-qty-n" data-testid="qty">{l.qty_milli / 1000}</span>
                <button type="button" className="btn btn-secondary btn-sq" aria-label={vi.increase}
                  disabled={locked} onClick={() => changeQty(l.key, 1000)}>+</button>
              </div>
              <button type="button" className="btn btn-danger" disabled={locked} onClick={() => remove(l.key)}>{vi.remove}</button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-secondary" disabled={locked} onClick={() => setCustomOpen(true)}>
          {vi.customPrice}
        </button>
      </main>
      <aside className="gc-side" inert={dialogOpen}>
        <div className="gc-total-label">{vi.total}</div>
        <div className="gc-total">{formatVnd(total)}</div>
        <button type="button" className="btn btn-primary btn-big" disabled={empty || locked} onClick={() => void pay("qr")}>
          {vi.payQr}
        </button>
        <button type="button" className="btn btn-secondary btn-big" disabled={empty || locked} onClick={() => void pay("cash")}>
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
          onPaid={() => { setModalSale(null); clearSent() }}
        />
      ) : null}
    </div>
  )
}
