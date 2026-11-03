import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, ApiError } from "../api/client"
import { vi } from "../i18n/vi"
import { OwnerPinDialog } from "./OwnerPinDialog"

vitest.mock("../api/client", async (orig) => {
  const m = await orig<typeof import("../api/client")>()
  return { ...m, api: { ownerLogin: vitest.fn() } }
})
const login = (api as unknown as { ownerLogin: ReturnType<typeof vitest.fn> }).ownerLogin

beforeEach(() => { login.mockReset(); localStorage.clear() })
afterEach(cleanup)

function enter(pin: string) {
  fireEvent.change(screen.getByLabelText(vi.ownerPin), { target: { value: pin } })
  fireEvent.click(screen.getByRole("button", { name: vi.confirm }))
}

describe("OwnerPinDialog", () => {
  it("uses a temporary login id matching the server pattern when unregistered", async () => {
    login.mockResolvedValue(null)
    const ok = vitest.fn()
    render(<OwnerPinDialog onSuccess={ok} />)
    enter("1234")
    await waitFor(() => expect(ok).toHaveBeenCalled())
    const id = login.mock.calls[0][1]
    expect(id).toMatch(/^[A-Za-z0-9-]{1,64}$/)
    expect(localStorage.getItem("pos_login_id")).toBe(id)
  })
  it("prefers the registered device id", async () => {
    login.mockResolvedValue(null)
    localStorage.setItem("pos_device_id", "dev-7")
    render(<OwnerPinDialog onSuccess={() => {}} />)
    enter("1234")
    await waitFor(() => expect(login).toHaveBeenCalledWith("1234", "dev-7"))
  })
  it("shows 401/429 detail verbatim", async () => {
    login.mockRejectedValue(new ApiError(429, "Sai PIN quá nhiều lần"))
    render(<OwnerPinDialog onSuccess={() => {}} />)
    enter("1234")
    await act(async () => {})
    expect((await screen.findByRole("alert")).textContent).toBe("Sai PIN quá nhiều lần")
  })
})
