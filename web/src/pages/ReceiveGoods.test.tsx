import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, ApiError } from "../api/client"
import { vi } from "../i18n/vi"
import { ReceiveGoods } from "./ReceiveGoods"

vitest.mock("../api/client", async (orig) => {
  const m = await orig<typeof import("../api/client")>()
  return { ...m, api: { ownerLookupBarcode: vitest.fn(), receive: vitest.fn(), ownerLogout: vitest.fn() } }
})
const A = api as unknown as Record<string, ReturnType<typeof vitest.fn>>

const noodle = {
  id: 1, barcode: "8934563138165", name: "Mì Hảo Hảo", unit: "gói", sell_price: 4500,
  track_stock: true, stock_qty_milli: 12000, last_cost: 3600, location: "grocery", active: true,
}
const onExpired = vitest.fn()

beforeEach(() => {
  Object.values(A).forEach((f) => f.mockReset())
  onExpired.mockReset()
  A.ownerLogout.mockResolvedValue(null)
})
afterEach(cleanup)

async function lookup(code: string) {
  render(<ReceiveGoods floor="floor1" onExpired={onExpired} onBack={() => {}} />)
  fireEvent.change(screen.getByLabelText(vi.barcodeInput), { target: { value: code } })
  fireEvent.submit(screen.getByLabelText(vi.barcodeInput).closest("form")!)
  await act(async () => {})
}
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

describe("ReceiveGoods", () => {
  it("known barcode prefills cost and shows stock", async () => {
    A.ownerLookupBarcode.mockResolvedValue(noodle)
    await lookup(noodle.barcode)
    expect(await screen.findByText("Mì Hảo Hảo")).toBeTruthy()
    expect(field(vi.costPrice).value).toBe("3.600")
    expect(screen.getByTestId("stock").textContent).toContain("Tồn kho: 12")
    expect(A.ownerLookupBarcode).toHaveBeenCalledWith(noodle.barcode, "grocery")
    expect(screen.queryByLabelText(vi.productName)).toBeNull()
  })

  it("unknown barcode shows name and sell price fields", async () => {
    A.ownerLookupBarcode.mockRejectedValue(new ApiError(404, "Không tìm thấy"))
    await lookup("8936036020434")
    expect(await screen.findByLabelText(vi.productName)).toBeTruthy()
    expect(screen.getByLabelText(vi.sellPrice)).toBeTruthy()
  })

  it("submit calls receive with qty 30 and unit_cost 3600", async () => {
    A.ownerLookupBarcode.mockResolvedValue(noodle)
    A.receive.mockResolvedValue({ product: noodle, stock_qty_milli: 42000, created: false })
    await lookup(noodle.barcode)
    await screen.findByText("Mì Hảo Hảo")
    fireEvent.change(field(vi.quantity), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: /^✓/ }))
    await waitFor(() => expect(A.receive).toHaveBeenCalledTimes(1))
    expect(A.receive).toHaveBeenCalledWith({
      barcode: noodle.barcode, location: "grocery", qty: 30, unit_cost: 3600,
    })
  })

  it("new product submit sends name, sell_price, unit", async () => {
    A.ownerLookupBarcode.mockRejectedValue(new ApiError(404, "x"))
    A.receive.mockResolvedValue({ product: noodle, stock_qty_milli: 24000, created: true })
    await lookup("8936036020434")
    fireEvent.change(await screen.findByLabelText(vi.productName), { target: { value: "Bánh Oreo" } })
    fireEvent.change(field(vi.sellPrice), { target: { value: "18.000" } })
    fireEvent.change(field(vi.quantity), { target: { value: "24" } })
    fireEvent.change(field(vi.costPrice), { target: { value: "14.500" } })
    fireEvent.click(screen.getByRole("button", { name: /^✓/ }))
    await waitFor(() => expect(A.receive).toHaveBeenCalled())
    expect(A.receive.mock.calls[0][0]).toMatchObject({
      barcode: "8936036020434", name: "Bánh Oreo", sell_price: 18000, qty: 24, unit_cost: 14500, location: "grocery",
    })
  })

  it("shows server 422 detail verbatim", async () => {
    A.ownerLookupBarcode.mockResolvedValue(noodle)
    A.receive.mockRejectedValue(new ApiError(422, "Số lượng không hợp lệ"))
    await lookup(noodle.barcode)
    await screen.findByText("Mì Hảo Hảo")
    fireEvent.change(field(vi.quantity), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: /^✓/ }))
    expect((await screen.findByRole("alert")).textContent).toBe("Số lượng không hợp lệ")
  })

  it("401 sends owner back to selling screen", async () => {
    A.ownerLookupBarcode.mockRejectedValue(new ApiError(401, "Phiên hết hạn"))
    await lookup(noodle.barcode)
    await waitFor(() => expect(onExpired).toHaveBeenCalled())
  })

  it("floor4 device defaults location to floor4", async () => {
    A.ownerLookupBarcode.mockResolvedValue(noodle)
    render(<ReceiveGoods floor="floor4" onExpired={onExpired} onBack={() => {}} />)
    fireEvent.change(screen.getByLabelText(vi.barcodeInput), { target: { value: "8934563138165" } })
    fireEvent.submit(screen.getByLabelText(vi.barcodeInput).closest("form")!)
    await act(async () => {})
    expect(A.ownerLookupBarcode).toHaveBeenCalledWith("8934563138165", "floor4")
  })

  it("logs out on unmount", async () => {
    const { unmount } = render(<ReceiveGoods floor="floor1" onExpired={onExpired} onBack={() => {}} />)
    unmount()
    await waitFor(() => expect(A.ownerLogout).toHaveBeenCalled())
  })

  it("idle 5 minutes calls onExpired", async () => {
    vitest.useFakeTimers()
    try {
      render(<ReceiveGoods floor="floor1" onExpired={onExpired} onBack={() => {}} />)
      act(() => { vitest.advanceTimersByTime(300000) })
      expect(onExpired).toHaveBeenCalled()
    } finally { vitest.useRealTimers() }
  })

  it("rejects malformed amounts with Vietnamese message", async () => {
    A.ownerLookupBarcode.mockResolvedValue(noodle)
    await lookup(noodle.barcode)
    await screen.findByText("Mì Hảo Hảo")
    fireEvent.change(field(vi.quantity), { target: { value: "3" } })
    fireEvent.change(field(vi.costPrice), { target: { value: "3.6" } })
    expect(screen.getByText(vi.invalidAmount)).toBeTruthy()
    expect((screen.getByRole("button", { name: /^✓/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("ignores a stale lookup response", async () => {
    let resolveFirst!: (p: unknown) => void
    A.ownerLookupBarcode
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce({ ...noodle, id: 2, name: "Bánh" })
    render(<ReceiveGoods floor="floor1" onExpired={onExpired} onBack={() => {}} />)
    const form = screen.getByLabelText(vi.barcodeInput).closest("form")!
    fireEvent.change(screen.getByLabelText(vi.barcodeInput), { target: { value: "111111" } })
    fireEvent.submit(form)
    fireEvent.change(screen.getByLabelText(vi.barcodeInput), { target: { value: "222222" } })
    fireEvent.submit(form)
    await act(async () => {})
    await act(async () => { resolveFirst(noodle) })
    expect(screen.getByText("Bánh")).toBeTruthy()
    expect(screen.queryByText("Mì Hảo Hảo")).toBeNull()
  })
})
