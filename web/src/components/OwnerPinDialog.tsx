import { useEffect, useRef, useState } from "react"
import { api, ApiError } from "../api/client"
import { vi } from "../i18n/vi"
import { ownerLoginId } from "../lib/deviceId"
import "./OwnerPinDialog.css"

interface Props {
  onSuccess: () => void
  onClose?: () => void
}

export function OwnerPinDialog({ onSuccess, onClose }: Props) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busyRef.current || !/^\d{4,6}$/.test(pin)) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await api.ownerLogin(pin, ownerLoginId())
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : vi.networkError)
      setPin("")
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="overlay">
      <form className="pin-box" role="dialog" aria-modal="true" aria-label={vi.enterPin} onSubmit={submit}>
        <h2 className="pin-title">{vi.enterPin}</h2>
        <input
          ref={input}
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          aria-label={vi.ownerPin}
          value={pin}
          disabled={busy}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        {error ? <div className="pin-error" role="alert">{error}</div> : null}
        <div className="pin-actions">
          {onClose ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>{vi.cancel}</button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy || !/^\d{4,6}$/.test(pin)}>{vi.confirm}</button>
        </div>
      </form>
    </div>
  )
}
