import { useState } from "react"
import { api, ApiError, type Floor } from "../api/client"
import { OwnerPinDialog } from "../components/OwnerPinDialog"
import { vi } from "../i18n/vi"
import { setDeviceId } from "../lib/deviceId"
import "./Form.css"

export function DeviceSetup({ onDone }: { onDone: () => void }) {
  const [authed, setAuthed] = useState(false)
  const [name, setName] = useState("")
  const [floor, setFloor] = useState<Floor>("floor1")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const d = await api.registerDevice(name.trim(), floor)
      setDeviceId(d.id)
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuthed(false)
      else setError(err instanceof ApiError ? err.detail : vi.networkError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form className="form-page" onSubmit={submit} inert={!authed}>
        <h1>{vi.deviceSetup}</h1>
        <label className="form-label">{vi.deviceName}
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="form-label">{vi.floor}
          <div className="seg">
            <button type="button" className="btn btn-secondary" aria-pressed={floor === "floor1"} onClick={() => setFloor("floor1")}>{vi.floor1}</button>
            <button type="button" className="btn btn-secondary" aria-pressed={floor === "floor4"} onClick={() => setFloor("floor4")}>{vi.floor4}</button>
          </div>
        </div>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button type="submit" className="btn btn-primary btn-big" disabled={busy || !name.trim()}>{vi.registerDevice}</button>
      </form>
      {authed ? null : <OwnerPinDialog onSuccess={() => setAuthed(true)} />}
    </>
  )
}
