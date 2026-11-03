import { useCallback, useEffect, useState } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { api, ApiError, type Device, type Service } from "./api/client"
import { vi } from "./i18n/vi"
import { getDeviceId } from "./lib/deviceId"
import { DeviceSetup } from "./pages/DeviceSetup"
import { FirstRunSetup } from "./pages/FirstRunSetup"
import { GroceryCheckout } from "./pages/GroceryCheckout"
import { ReceiveGoods } from "./pages/ReceiveGoods"
import { ServicePicker } from "./pages/ServicePicker"
import "./pages/Form.css"

type Boot =
  | { kind: "loading" }
  | { kind: "error"; msg: string }
  | { kind: "setup" }
  | { kind: "device" }
  | { kind: "ready"; device: Device }

export default function App({ now }: { now?: () => Date } = {}) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" })
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()

  const reboot = useCallback(() => {
    setBoot({ kind: "loading" })
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let alive = true
    const set = (b: Boot) => { if (alive) setBoot(b) }
    ;(async () => {
      try {
        const { configured } = await api.setupStatus()
        if (!configured) return set({ kind: "setup" })
        const id = getDeviceId()
        if (!id) return set({ kind: "device" })
        try {
          set({ kind: "ready", device: await api.getDevice(id) })
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) set({ kind: "device" })
          else throw e
        }
      } catch (e) {
        set({ kind: "error", msg: e instanceof ApiError ? e.detail : vi.networkError })
      }
    })()
    return () => { alive = false }
  }, [attempt])

  if (boot.kind === "loading") return <div className="form-page">{vi.loading}</div>
  if (boot.kind === "error") {
    return (
      <div className="form-page">
        <div className="form-error" role="alert">{boot.msg}</div>
        <button type="button" className="btn btn-primary" onClick={reboot}>{vi.retry}</button>
      </div>
    )
  }
  if (boot.kind === "setup") {
    return (
      <Routes>
        <Route path="/setup" element={<FirstRunSetup onDone={() => { navigate("/device"); reboot() }} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }
  if (boot.kind === "device") {
    return (
      <Routes>
        <Route path="/device" element={<DeviceSetup onDone={() => { navigate("/"); reboot() }} />} />
        <Route path="*" element={<Navigate to="/device" replace />} />
      </Routes>
    )
  }

  const device = boot.device
  const pick = (s: Service) => navigate(s === "grocery" ? "/grocery" : "/soon")
  const expired = () => navigate("/grocery", { state: { expired: true } })
  return (
    <Routes>
      <Route path="/" element={
        // R14: floor 1 sells grocery only, so skip the one-option picker.
        device.floor === "floor1"
          ? <Navigate to="/grocery" replace />
          : <ServicePicker floor={device.floor} now={now} onPick={pick} />
      } />
      <Route path="/grocery" element={<GroceryRoute deviceId={device.id} onReceive={() => navigate("/receive")} />} />
      <Route path="/receive" element={<ReceiveGoods floor={device.floor} onExpired={expired} onBack={() => navigate("/grocery")} />} />
      <Route path="/soon" element={
        <div className="form-page">
          <h1>{vi.comingSoon}</h1>
          <p className="form-hint">{vi.comingSoonBody}</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/")}>{vi.changeService}</button>
        </div>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function GroceryRoute({ deviceId, onReceive }: { deviceId: string; onReceive: () => void }) {
  const loc = useLocation()
  const navigate = useNavigate()
  const expired = (loc.state as { expired?: boolean } | null)?.expired === true
  // Read the flag once; GroceryCheckout keeps the notice for 10 s / until the first scan.
  const [notice] = useState(expired ? vi.sessionExpired : undefined)
  // Drop the flag from history so a reload does not show the notice again.
  useEffect(() => {
    if (expired) navigate(".", { replace: true, state: null })
  }, [expired, navigate])
  return <GroceryCheckout deviceId={deviceId} onReceive={onReceive} notice={notice} />
}
