import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api } from "../api/client"
import { vi } from "../i18n/vi"
import { DeviceSetup } from "./DeviceSetup"

vitest.mock("../api/client", async (orig) => {
  const m = await orig<typeof import("../api/client")>()
  return { ...m, api: { ownerLogin: vitest.fn(), registerDevice: vitest.fn(), ownerLogout: vitest.fn() } }
})
const A = api as unknown as Record<string, ReturnType<typeof vitest.fn>>
beforeEach(() => { Object.values(A).forEach((f) => f.mockReset()); localStorage.clear() })
afterEach(cleanup)

describe("DeviceSetup", () => {
  it("stores device id and logs the owner out when done", async () => {
    A.ownerLogin.mockResolvedValue(null)
    A.registerDevice.mockResolvedValue({ id: "dev-1", name: "Quầy", floor: "floor1" })
    A.ownerLogout.mockResolvedValue(null)
    const done = vitest.fn()
    render(<DeviceSetup onDone={done} />)
    fireEvent.change(screen.getByLabelText(vi.ownerPin), { target: { value: "1234" } })
    fireEvent.click(screen.getByRole("button", { name: vi.confirm }))
    fireEvent.change(await screen.findByLabelText(vi.deviceName), { target: { value: "Quầy" } })
    fireEvent.click(screen.getByRole("button", { name: vi.registerDevice }))
    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(localStorage.getItem("pos_device_id")).toBe("dev-1")
    expect(A.ownerLogout).toHaveBeenCalled()
  })
})
