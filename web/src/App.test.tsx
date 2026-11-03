import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { api, ApiError } from "./api/client"
import { vi } from "./i18n/vi"
import App from "./App"

vitest.mock("./api/client", async (orig) => {
  const m = await orig<typeof import("./api/client")>()
  return {
    ...m,
    api: {
      setupStatus: vitest.fn(), getDevice: vitest.fn(), pendingSale: vitest.fn(),
      lookupBarcode: vitest.fn(), ownerLogout: vitest.fn(), ownerLookupBarcode: vitest.fn(),
    },
  }
})
const A = api as unknown as Record<string, ReturnType<typeof vitest.fn>>

beforeEach(() => {
  Object.values(A).forEach((f) => f.mockReset())
  A.pendingSale.mockResolvedValue(null)
  A.ownerLogout.mockResolvedValue(null)
  localStorage.clear()
})
afterEach(cleanup)

function LocProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + "|" + JSON.stringify(loc.state ?? null)}</div>
}

async function open(path: string | { pathname: string; state: unknown } = "/") {
  render(<MemoryRouter initialEntries={[path]}><App /><LocProbe /></MemoryRouter>)
  await act(async () => {})
  await act(async () => {})
}

describe("App routing", () => {
  it("unconfigured goes to setup", async () => {
    A.setupStatus.mockResolvedValue({ configured: false })
    await open()
    expect(screen.getByRole("heading", { name: vi.setupTitle })).toBeTruthy()
  })

  it("unknown device goes to device setup", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    await open()
    expect(screen.getByRole("heading", { name: vi.deviceSetup })).toBeTruthy()
  })

  it("404 device goes to device setup", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockRejectedValue(new ApiError(404, "x"))
    localStorage.setItem("pos_device_id", "gone")
    await open()
    expect(screen.getByRole("heading", { name: vi.deviceSetup })).toBeTruthy()
  })

  it("floor1 device lands on grocery (no one-option picker)", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockResolvedValue({ id: "d1", name: "Quầy", floor: "floor1" })
    localStorage.setItem("pos_device_id", "d1")
    await open()
    expect(screen.getByTestId("loc").textContent).toBe("/grocery|null")
    expect(screen.getByLabelText(vi.barcodeInput)).toBeTruthy()
    expect(screen.queryByRole("heading", { name: vi.chooseService })).toBeNull()
    expect(screen.queryByRole("button", { name: vi.pub })).toBeNull()
  })

  it("session-expired notice clears history state so a reload does not show it again", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockResolvedValue({ id: "d1", name: "Quầy", floor: "floor1" })
    localStorage.setItem("pos_device_id", "d1")
    await open({ pathname: "/grocery", state: { expired: true } })
    expect(screen.getByRole("status").textContent).toBe(vi.sessionExpired)
    expect(screen.getByTestId("loc").textContent).toBe("/grocery|null")
  })

  it("floor4 device sees Trà & Kem and Pub", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockResolvedValue({ id: "d4", name: "Tầng 4", floor: "floor4" })
    localStorage.setItem("pos_device_id", "d4")
    await open()
    expect(screen.getByRole("heading", { name: vi.chooseService })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Trà & Kem" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pub" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Tạp hóa" })).toBeNull()
  })

  it("idle on /receive logs out and returns to selling screen with notice", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockResolvedValue({ id: "d1", name: "Quầy", floor: "floor1" })
    localStorage.setItem("pos_device_id", "d1")
    vitest.useFakeTimers()
    try {
      await open("/receive")
      act(() => { vitest.advanceTimersByTime(300000) })
      await act(async () => {})
      await act(async () => { vitest.advanceTimersByTime(10) })
      expect(A.ownerLogout).toHaveBeenCalled()
    } finally { vitest.useRealTimers() }
    expect(screen.getByRole("status").textContent).toBe(vi.sessionExpired)
  })
})
