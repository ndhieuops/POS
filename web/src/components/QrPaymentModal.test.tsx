import { afterEach, describe, expect, it, vi as vitest } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, ApiError, type SaleOut } from "../api/client"
import { vi } from "../i18n/vi"
import { QrPaymentModal } from "./QrPaymentModal"

vitest.mock("../api/client", async (orig) => {
  const m = await orig<typeof import("../api/client")>()
  return { ...m, api: { confirm: vitest.fn() } }
})

const sale: SaleOut = { id: 7, status: "awaiting_payment", total: 37500, lines: [], qr_payload: "000201ABC" }
const confirm = api.confirm as unknown as ReturnType<typeof vitest.fn>

afterEach(() => { cleanup(); confirm.mockReset() })

describe("QrPaymentModal", () => {
  it("has no cancel/close button and shows total, QR, texts", () => {
    const { container } = render(<QrPaymentModal sale={sale} onPaid={() => {}} />)
    expect(screen.queryByRole("button", { name: /hủy|cancel|đóng/i })).toBeNull()
    expect(screen.getByText("37.500đ")).toBeTruthy()
    expect(screen.getByText(vi.waitingTransfer)).toBeTruthy()
    expect(screen.getByText(vi.scannerPaused)).toBeTruthy()
    expect(Number(container.querySelector("svg")!.getAttribute("height"))).toBeGreaterThanOrEqual(240)
  })

  it("Escape and backdrop do nothing", () => {
    render(<QrPaymentModal sale={sale} onPaid={() => {}} />)
    fireEvent.keyDown(document, { key: "Escape" })
    fireEvent.click(screen.getByRole("dialog"))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(confirm).not.toHaveBeenCalled()
  })

  it("double click sends one bank_qr confirm", async () => {
    confirm.mockResolvedValue({ ...sale, status: "paid" })
    const onPaid = vitest.fn()
    render(<QrPaymentModal sale={sale} onPaid={onPaid} />)
    const b = screen.getByRole("button", { name: vi.moneyReceived })
    fireEvent.click(b)
    fireEvent.click(b)
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith(7, "bank_qr")
  })

  it("cash button confirms cash", async () => {
    confirm.mockResolvedValue({ ...sale, status: "paid" })
    render(<QrPaymentModal sale={sale} onPaid={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: vi.payCashSmall }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(7, "cash"))
  })

  it("shows server error and re-enables", async () => {
    confirm.mockRejectedValue(new ApiError(500, "Lỗi máy chủ X"))
    render(<QrPaymentModal sale={sale} onPaid={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: vi.moneyReceived }))
    expect(await screen.findByText("Lỗi máy chủ X")).toBeTruthy()
    expect((screen.getByRole("button", { name: vi.moneyReceived }) as HTMLButtonElement).disabled).toBe(false)
  })
})
