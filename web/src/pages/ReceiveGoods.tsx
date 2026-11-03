import { useCallback, useRef, useState } from "react"
import { api, ApiError, type Floor, type Location, type ProductOwnerOut } from "../api/client"
import { useBarcodeScanner } from "../hooks/useBarcodeScanner"
import { vi } from "../i18n/vi"
import { formatVnd } from "../lib/money"
import { parseDong } from "../lib/parseDong"
import "./Form.css"

interface Props {
  floor: Floor
  onExpired: () => void
  onBack: () => void
}

type Found = { kind: "known"; product: ProductOwnerOut } | { kind: "new" }
const dots = (n: number) => formatVnd(n).replace("đ", "")

export function ReceiveGoods({ floor, onExpired, onBack }: Props) {
  const [location, setLocation] = useState<Location>(floor === "floor4" ? "floor4" : "grocery")
  const [manual, setManual] = useState("")
  const [code, setCode] = useState<string | null>(null)
  const [found, setFound] = useState<Found | null>(null)
  const [name, setName] = useState("")
  const [sell, setSell] = useState("")
  const [qty, setQty] = useState("")
  const [cost, setCost] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { onExpired(); return }
    setError(e instanceof ApiError ? e.detail : vi.networkError)
  }, [onExpired])

  const lookup = useCallback(async (raw: string, loc: Location) => {
    const c = raw.trim()
    setManual("")
    if (!c) return
    setError(null)
    setOk(null)
    setCode(c)
    setFound(null)
    setQty("")
    try {
      const p = await api.ownerLookupBarcode(c, loc)
      setFound({ kind: "known", product: p })
      setCost(p.last_cost != null ? dots(p.last_cost) : "")
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setFound({ kind: "new" })
        setName(""); setSell(""); setCost("")
      } else {
        setCode(null)
        fail(e)
      }
    }
  }, [fail])

  useBarcodeScanner((c) => void lookup(c, location), !busy)

  function chooseLocation(loc: Location) {
    setLocation(loc)
    if (code) void lookup(code, loc)
  }

  const qtyN = /^\d+$/.test(qty.trim()) ? parseInt(qty.trim(), 10) : null
  const costN = parseDong(cost)
  const sellN = parseDong(sell)
  const canSubmit =
    found !== null && qtyN !== null && qtyN >= 1 && costN !== null &&
    (found.kind === "known" || (name.trim() !== "" && sellN !== null && sellN > 0))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busyRef.current || !code || !canSubmit || qtyN === null || costN === null) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const body = found!.kind === "known"
        ? { barcode: code, location, qty: qtyN, unit_cost: costN }
        : { barcode: code, location, qty: qtyN, unit_cost: costN, name: name.trim(), sell_price: sellN!, unit: "cái" }
      const r = await api.receive(body)
      setOk(`${vi.received}: ${r.product.name} · ${vi.inStock} ${r.stock_qty_milli / 1000}`)
      setCode(null); setFound(null); setQty(""); setCost(""); setName(""); setSell("")
    } catch (err) {
      fail(err)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const stock = found?.kind === "known" ? found.product.stock_qty_milli / 1000 : 0

  return (
    <div className="form-page">
      <h1>{vi.receiveGoods}</h1>
      <div className="seg">
        <button type="button" className="btn btn-secondary" aria-pressed={location === "grocery"} onClick={() => chooseLocation("grocery")}>{vi.locationGrocery}</button>
        <button type="button" className="btn btn-secondary" aria-pressed={location === "floor4"} onClick={() => chooseLocation("floor4")}>{vi.locationFloor4}</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void lookup(manual, location) }}>
        <input className="form-input" style={{ width: "100%", boxSizing: "border-box" }} aria-label={vi.barcodeInput}
          placeholder={vi.scanOrType} value={manual} onChange={(e) => setManual(e.target.value)} disabled={busy} />
      </form>
      {ok ? <div className="form-ok" role="status">{ok}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {found ? (
        <form className="form-card" onSubmit={submit}>
          {found.kind === "known" ? (
            <>
              <p className="form-meta"><b style={{ fontSize: 24, color: "var(--text)" }}>{found.product.name}</b> {code}</p>
              <p className="form-meta" data-testid="stock">{vi.inStock}: {stock} · {vi.currentSellPrice}: {formatVnd(found.product.sell_price)}</p>
            </>
          ) : (
            <>
              <p className="form-meta"><b style={{ fontSize: 24, color: "var(--text)" }}>{vi.newBarcode}</b> {code}</p>
              <label className="form-label">{vi.productName}
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="form-label">{vi.sellPrice}
                <input className="form-input" inputMode="numeric" placeholder="18.000" value={sell} onChange={(e) => setSell(e.target.value)} />
              </label>
            </>
          )}
          <label className="form-label">{vi.quantity}
            <input className="form-input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="form-label">{vi.costPrice}
            <input className="form-input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          {found.kind === "known" ? <p className="form-hint">{vi.costHint}</p> : null}
          <button type="submit" className="btn btn-primary btn-big" disabled={busy || !canSubmit}>
            {found.kind === "known"
              ? `${vi.addStock}${qtyN ? ` · ${vi.stockBecomes} ${stock + qtyN}` : ""}`
              : vi.saveNewProduct}
          </button>
        </form>
      ) : null}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBack}>{vi.backToSelling}</button>
    </div>
  )
}
