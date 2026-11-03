import { useState } from "react"
import { api, ApiError } from "../api/client"
import { vi } from "../i18n/vi"
import "./Form.css"

export function FirstRunSetup({ onDone }: { onDone: () => void }) {
  const [shop, setShop] = useState("")
  const [pin, setPin] = useState("")
  const [bin, setBin] = useState("")
  const [acct, setAcct] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = shop.trim() && /^\d{4,6}$/.test(pin) && /^\d{6}$/.test(bin) && /^\d{1,19}$/.test(acct) && name.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !valid) return
    setBusy(true)
    setError(null)
    try {
      await api.setup({
        shop_name: shop.trim(), owner_pin: pin, bank_bin: bin,
        bank_account_no: acct, bank_account_name: name.trim(),
      })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : vi.networkError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-page" onSubmit={submit}>
      <h1>{vi.setupTitle}</h1>
      <p className="form-hint">{vi.setupIntro}</p>
      <label className="form-label">{vi.shopName}
        <input className="form-input" value={shop} onChange={(e) => setShop(e.target.value)} />
      </label>
      <label className="form-label">{vi.ownerPinNew}
        <input className="form-input" type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="form-label">{vi.bankBin}
        <input className="form-input" inputMode="numeric" maxLength={6} value={bin}
          onChange={(e) => setBin(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="form-label">{vi.bankAccountNo}
        <input className="form-input" inputMode="numeric" maxLength={19} value={acct}
          onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="form-label">{vi.bankAccountName}
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <button type="submit" className="btn btn-primary btn-big" disabled={busy || !valid}>{vi.save}</button>
    </form>
  )
}
