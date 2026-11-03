import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { api, ApiError } from "./api/client"
import { vi } from "./i18n/vi"
import App from "./App"

vitest.mock("./api/client", async (orig) => {
  const m = await orig<typeof import("./api/client")>()
  return {
    ...m,
    api: {
      setupStatus: vitest.fn(), getDevice: vitest.fn(), pendingSale: vitest.fn(),
      lookupBarcode: vitest.fn(), ownerLogout: vitest.fn(),
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

async function open(path = "/") {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
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

  it("floor1 device sees only Tạp hóa", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockResolvedValue({ id: "d1", name: "Quầy", floor: "floor1" })
    localStorage.setItem("pos_device_id", "d1")
    await open()
    expect(screen.getByRole("button", { name: "Tạp hóa" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: vi.pub })).toBeNull()
    expect(screen.queryByRole("button", { name: vi.teaIceCream })).toBeNull()
  })

  it("floor4 device sees Trà & Kem and Pub", async () => {
    A.setupStatus.mockResolvedValue({ configured: true })
    A.getDevice.mockResolvedValue({ id: "d4", name: "Tầng 4", floor: "floor4" })
    localStorage.setItem("pos_device_id", "d4")
    await open()
    expect(screen.getByRole("button", { name: "Trà & Kem" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pub" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Tạp hóa" })).toBeNull()
  })
})
