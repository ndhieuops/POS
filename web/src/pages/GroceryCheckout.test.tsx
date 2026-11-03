import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, ApiError, type SaleOut } from "../api/client"
import { vi } from "../i18n/vi"
import { GroceryCheckout } from "./GroceryCheckout"

vitest.mock("../api/client", async (orig) => {
  const m = await orig<typeof import("../api/client")>()
  return {
    ...m,
    api: {
      lookupBarcode: vitest.fn(), createSale: vitest.fn(), requestQr: vitest.fn(),
      confirm: vitest.fn(), pendingSale: vitest.fn(), ownerLogin: vitest.fn(),
    },
  }
})
const A = api as unknown as Record<string, ReturnType<typeof vitest.fn>>

const milk = { id: 1, barcode: "8934563138165", name: "Sữa", unit: "hộp", sell_price: 4500, track_stock: true, stock_qty_milli: 9000 }
const qrSale: SaleOut = { id: 9, status: "awaiting_payment", total: 4500, lines: [], qr_payload: "QR" }

function scan(code: string) {
  for (const c of code) fireEvent.keyDown(window, { key: c })
  fireEvent.keyDown(window, { key: "Enter" })
}

beforeEach(() => {
  Object.values(A).forEach((f) => f.mockReset())
  A.pendingSale.mockResolvedValue(null)
  A.lookupBarcode.mockResolvedValue(milk)
})
afterEach(cleanup)

async function renderPage() {
  render(<GroceryCheckout deviceId="dev1" />)
  await act(async () => {})
}

describe("GroceryCheckout", () => {
  it("adds scanned item", async () => {
    await renderPage()
    scan(milk.barcode)
    expect(await screen.findByText("Sữa")).toBeTruthy()
    expect(screen.getByText("4.500đ", { selector: ".gc-price" })).toBeTruthy()
  })

  it("scanning same item twice gives qty 2", async () => {
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    scan(milk.barcode)
    await waitFor(() => expect(screen.getByTestId("qty").textContent).toBe("2"))
    expect(screen.getAllByTestId("cart-line")).toHaveLength(1)
  })

  it("unknown barcode shows not found and opens custom price", async () => {
    A.lookupBarcode.mockRejectedValue(new ApiError(404, "x"))
    await renderPage()
    scan("1234567890")
    expect(await screen.findByText(vi.notFound)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: vi.addCustomPrice }))
    fireEvent.click(screen.getByRole("button", { name: "2" }))
    fireEvent.click(screen.getByRole("button", { name: vi.addToCart }))
    expect(screen.getAllByText(vi.customPrice).length).toBeGreaterThan(0)
    expect(screen.getByTestId("cart-line").textContent).toContain("2.000đ")
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.confirm.mockResolvedValue({ ...qrSale, status: "paid" })
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    await waitFor(() => expect(A.createSale).toHaveBeenCalled())
    expect(A.createSale.mock.calls[0][0].lines).toEqual([
      { product_id: null, name: vi.customPrice, unit: "cái", qty_milli: 1000, unit_price: 2000, note: null },
    ])
  })

  it("ignores scans while QR open", async () => {
    A.pendingSale.mockResolvedValue(qrSale)
    await renderPage()
    expect(screen.getByRole("dialog")).toBeTruthy()
    scan(milk.barcode)
    await act(async () => {})
    expect(A.lookupBarcode).not.toHaveBeenCalled()
  })

  it("restores pending QR on load", async () => {
    A.pendingSale.mockResolvedValue(qrSale)
    await renderPage()
    expect(screen.getByText(vi.waitingTransfer)).toBeTruthy()
    expect(A.pendingSale).toHaveBeenCalledWith("dev1")
  })

  it("QR pay opens modal with server total; paying clears cart", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.requestQr.mockResolvedValue({ ...qrSale, total: 4600 })
    A.confirm.mockResolvedValue({ ...qrSale, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    expect(await screen.findByText("4.600đ", { selector: ".qr-total" })).toBeTruthy()
    expect(A.createSale.mock.calls[0][0]).toMatchObject({
      device_id: "dev1", service: "grocery",
      lines: [{ product_id: 1, name: "Sữa", unit: "hộp", qty_milli: 1000, unit_price: 4500 }],
    })
    fireEvent.click(screen.getByRole("button", { name: vi.moneyReceived }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByText(vi.emptyCart)).toBeTruthy()
  })

  it("409 pending on create opens modal for that sale", async () => {
    A.createSale.mockRejectedValue(new ApiError(409, "pending", { sale: qrSale }))
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(screen.getByText("4.500đ", { selector: ".qr-total" })).toBeTruthy()
  })

  it("paying a foreign pending sale (409) keeps the current cart", async () => {
    const old = { ...qrSale, id: 3, total: 37500 }
    A.createSale.mockRejectedValue(new ApiError(409, "pending", { sale: old }))
    A.confirm.mockResolvedValue({ ...old, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    expect(await screen.findByText("37.500đ", { selector: ".qr-total" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: vi.moneyReceived }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(A.confirm).toHaveBeenCalledWith(3, "bank_qr")
    expect(screen.getByText("Sữa")).toBeTruthy()
  })

  it("ignores scans while createSale is in flight", async () => {
    let release!: (s: SaleOut) => void
    A.createSale.mockReturnValue(new Promise<SaleOut>((r) => { release = r }))
    A.requestQr.mockResolvedValue(qrSale)
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    scan(milk.barcode)
    await act(async () => {})
    expect(A.lookupBarcode).toHaveBeenCalledTimes(1)
    expect((screen.getByRole("button", { name: vi.increase }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { release({ ...qrSale, status: "open" }) })
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })

  it("background is inert and Enter does not re-run pay while QR open", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.requestQr.mockResolvedValue(qrSale)
    const { container } = render(<GroceryCheckout deviceId="dev1" />)
    await act(async () => {})
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    await screen.findByRole("dialog")
    expect(container.querySelector(".gc-main")!.hasAttribute("inert")).toBe(true)
    expect(container.querySelector(".gc-side")!.hasAttribute("inert")).toBe(true)
    for (const c of "8934563138165") fireEvent.keyDown(window, { key: c })
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    act(() => { document.activeElement!.dispatchEvent(enter) })
    expect(enter.defaultPrevented).toBe(true)
    await act(async () => {})
    expect(A.createSale).toHaveBeenCalledTimes(1)
    expect(A.lookupBarcode).toHaveBeenCalledTimes(1)
    expect(A.confirm).not.toHaveBeenCalled()
  })

  it("Enter in custom dialog does not re-press a keypad digit", async () => {
    await renderPage()
    fireEvent.click(screen.getByRole("button", { name: vi.customPrice }))
    const five = screen.getByRole("button", { name: "5" })
    fireEvent.click(five)
    expect(screen.getByTestId("custom-amount").textContent).toBe("5.000đ")
    five.focus()
    for (const c of "8934563138165") fireEvent.keyDown(window, { key: c })
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    act(() => { five.dispatchEvent(enter) })
    expect(enter.defaultPrevented).toBe(true)
    expect(screen.getByTestId("custom-amount").textContent).toBe("5.000đ")
  })

  it("lost requestQr response: retry gets own sale back, paid clears cart", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.requestQr.mockRejectedValueOnce(new ApiError(0, vi.networkError))
    A.confirm.mockResolvedValue({ ...qrSale, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    expect(await screen.findByText(vi.networkError)).toBeTruthy()
    A.requestQr.mockResolvedValueOnce(qrSale)
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    await screen.findByRole("dialog")
    expect(A.createSale).toHaveBeenCalledTimes(1)
    expect(A.requestQr.mock.calls).toEqual([[9], [9]])
    fireEvent.click(screen.getByRole("button", { name: vi.moneyReceived }))
    await waitFor(() => expect(screen.getByText(vi.emptyCart)).toBeTruthy())
    expect(A.confirm).toHaveBeenCalledWith(9, "bank_qr")
  })

  it("lost requestQr response on a busy server: 409 for own id still clears cart", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.requestQr.mockRejectedValueOnce(new ApiError(0, vi.networkError))
    A.confirm.mockResolvedValue({ ...qrSale, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    expect(await screen.findByText(vi.networkError)).toBeTruthy()
    A.requestQr.mockRejectedValueOnce(new ApiError(409, "pending", { sale: qrSale }))
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: vi.moneyReceived }))
    await waitFor(() => expect(screen.getByText(vi.emptyCart)).toBeTruthy())
  })

  it("locked until pending-sale check resolves", async () => {
    let release!: (s: SaleOut | null) => void
    A.pendingSale.mockReturnValue(new Promise((r) => { release = r }))
    render(<GroceryCheckout deviceId="dev1" />)
    scan(milk.barcode)
    await act(async () => {})
    expect(A.lookupBarcode).not.toHaveBeenCalled()
    await act(async () => { release(null) })
    scan(milk.barcode)
    expect(await screen.findByText("Sữa")).toBeTruthy()
  })

  it("pending-sale error is retried once; failure shows detail", async () => {
    A.pendingSale.mockRejectedValueOnce(new ApiError(500, "Lỗi A")).mockResolvedValueOnce(qrSale)
    await renderPage()
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(A.pendingSale).toHaveBeenCalledTimes(2)
    cleanup()
    A.pendingSale.mockReset()
    A.pendingSale.mockRejectedValue(new ApiError(500, "Lỗi B"))
    await renderPage()
    expect(await screen.findByText("Lỗi B")).toBeTruthy()
    expect(A.pendingSale).toHaveBeenCalledTimes(2)
  })

  it("bank not configured keeps cart and shows detail", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.requestQr.mockRejectedValue(new ApiError(409, "Chưa cấu hình ngân hàng", { detail: "Chưa cấu hình ngân hàng" }))
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payQr }))
    expect(await screen.findByText("Chưa cấu hình ngân hàng")).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByText("Sữa")).toBeTruthy()
  })

  it("cash sale needs a second tap in the confirm dialog, then clears cart", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open", total: 4600 })
    A.confirm.mockResolvedValue({ ...qrSale, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    const dlg = await screen.findByRole("dialog", { name: vi.cashTitle })
    expect(dlg.textContent).toContain(vi.cashTitle)
    expect(screen.getByText("4.600đ", { selector: ".cash-total" })).toBeTruthy()
    expect(A.confirm).not.toHaveBeenCalled()
    expect(screen.getByText("Sữa")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: vi.cashReceived }))
    await waitFor(() => expect(screen.getByText(vi.emptyCart)).toBeTruthy())
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(A.confirm).toHaveBeenCalledWith(9, "cash")
    expect(A.requestQr).not.toHaveBeenCalled()
  })

  it("cash dialog: Quay lại keeps cart, does not confirm; re-pay reuses the open sale", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.confirm.mockResolvedValue({ ...qrSale, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    await screen.findByRole("dialog", { name: vi.cashTitle })
    fireEvent.click(screen.getByRole("button", { name: vi.back }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByText("Sữa")).toBeTruthy()
    expect(A.confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    await screen.findByRole("dialog", { name: vi.cashTitle })
    expect(A.createSale).toHaveBeenCalledTimes(1)
  })

  it("cash dialog is safe: scanner off, background inert, focus inside, Enter guarded", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    const { container } = render(<GroceryCheckout deviceId="dev1" />)
    await act(async () => {})
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    const dlg = await screen.findByRole("dialog", { name: vi.cashTitle })
    expect(container.querySelector(".gc-main")!.hasAttribute("inert")).toBe(true)
    expect(container.querySelector(".gc-side")!.hasAttribute("inert")).toBe(true)
    expect(dlg.contains(document.activeElement)).toBe(true)
    scan(milk.barcode)
    await act(async () => {})
    expect(A.lookupBarcode).toHaveBeenCalledTimes(1)
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    act(() => { document.activeElement!.dispatchEvent(enter) })
    expect(enter.defaultPrevented).toBe(true)
    expect(A.confirm).not.toHaveBeenCalled()
  })

  it("lost cash confirm response: re-pay reuses the same sale, no duplicate", async () => {
    A.createSale.mockResolvedValue({ ...qrSale, status: "open" })
    A.confirm.mockRejectedValueOnce(new ApiError(0, vi.networkError)).mockResolvedValue({ ...qrSale, status: "paid" })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    await screen.findByRole("dialog", { name: vi.cashTitle })
    fireEvent.click(screen.getByRole("button", { name: vi.cashReceived }))
    expect(await screen.findByText(vi.networkError)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: vi.back }))
    expect(screen.getByText("Sữa")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    await screen.findByRole("dialog", { name: vi.cashTitle })
    fireEvent.click(screen.getByRole("button", { name: vi.cashReceived }))
    await waitFor(() => expect(screen.getByText(vi.emptyCart)).toBeTruthy())
    expect(A.createSale).toHaveBeenCalledTimes(1)
    expect(A.confirm).toHaveBeenCalledTimes(2)
    expect(A.confirm.mock.calls).toEqual([[9, "cash"], [9, "cash"]])
  })

  it("changed cart after Quay lại creates a new sale", async () => {
    A.createSale.mockResolvedValueOnce({ ...qrSale, status: "open" }).mockResolvedValueOnce({ ...qrSale, id: 10, status: "open", total: 9000 })
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    await screen.findByRole("dialog", { name: vi.cashTitle })
    fireEvent.click(screen.getByRole("button", { name: vi.back }))
    fireEvent.click(screen.getByRole("button", { name: vi.increase }))
    fireEvent.click(screen.getByRole("button", { name: vi.payCash }))
    expect(await screen.findByText("9.000đ", { selector: ".cash-total" })).toBeTruthy()
    expect(A.createSale).toHaveBeenCalledTimes(2)
    expect(A.createSale.mock.calls[1][0].lines[0].qty_milli).toBe(2000)
  })

  it("Nhập hàng is disabled while the cart has items", async () => {
    render(<GroceryCheckout deviceId="dev1" onReceive={() => {}} />)
    await act(async () => {})
    expect((screen.getByRole("button", { name: vi.receiveGoods }) as HTMLButtonElement).disabled).toBe(false)
    scan(milk.barcode)
    await screen.findByText("Sữa")
    expect((screen.getByRole("button", { name: vi.receiveGoods }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: vi.remove }))
    expect((screen.getByRole("button", { name: vi.receiveGoods }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("keeps focus on the barcode input after actions and dialog close; manual Enter submits", async () => {
    await renderPage()
    const input = screen.getByLabelText(vi.barcodeInput) as HTMLInputElement
    expect(document.activeElement).toBe(input)
    scan(milk.barcode)
    await screen.findByText("Sữa")
    const plus = screen.getByRole("button", { name: vi.increase })
    plus.focus()
    fireEvent.click(plus)
    expect(document.activeElement).toBe(input)
    fireEvent.click(screen.getByRole("button", { name: vi.customPrice }))
    expect(document.activeElement).not.toBe(input)
    fireEvent.click(screen.getByRole("button", { name: vi.cancel }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(input)
    // Slow typing (not a scan) followed by Enter goes through the input's form.
    fireEvent.change(input, { target: { value: "8934563138165" } })
    fireEvent.submit(input.closest("form")!)
    await waitFor(() => expect(A.lookupBarcode).toHaveBeenCalledTimes(2))
    expect(A.lookupBarcode).toHaveBeenLastCalledWith("8934563138165")
  })

  it("empty cart disables pay buttons", async () => {
    await renderPage()
    expect((screen.getByRole("button", { name: vi.payQr }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: vi.payCash }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("plus/minus/remove", async () => {
    await renderPage()
    scan(milk.barcode)
    await screen.findByText("Sữa")
    fireEvent.click(screen.getByRole("button", { name: vi.increase }))
    expect(screen.getByTestId("qty").textContent).toBe("2")
    fireEvent.click(screen.getByRole("button", { name: vi.decrease }))
    expect(screen.getByTestId("qty").textContent).toBe("1")
    fireEvent.click(screen.getByRole("button", { name: vi.remove }))
    expect(screen.getByText(vi.emptyCart)).toBeTruthy()
  })

  it("Nhập hàng opens PIN dialog, locks scanner, then navigates on success", async () => {
    A.ownerLogin.mockResolvedValue(null)
    const onReceive = vitest.fn()
    render(<GroceryCheckout deviceId="dev1" onReceive={onReceive} />)
    await act(async () => {})
    fireEvent.click(screen.getByRole("button", { name: vi.receiveGoods }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    scan(milk.barcode)
    expect(A.lookupBarcode).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(vi.ownerPin), { target: { value: "1234" } })
    fireEvent.click(screen.getByRole("button", { name: vi.confirm }))
    await waitFor(() => expect(onReceive).toHaveBeenCalled())
  })

  it("shows notice as info (not error)", async () => {
    render(<GroceryCheckout deviceId="dev1" notice={vi.sessionExpired} />)
    await act(async () => {})
    const n = screen.getByRole("status")
    expect(n.textContent).toBe("Hết phiên chủ quán, vui lòng nhập lại mã PIN")
    expect(n.className).toContain("gc-info")
    expect(n.className).not.toContain("gc-error")
  })

  it("notice clears after 10 s", async () => {
    vitest.useFakeTimers()
    try {
      render(<GroceryCheckout deviceId="dev1" notice={vi.sessionExpired} />)
      await act(async () => {})
      act(() => { vitest.advanceTimersByTime(9000) })
      expect(screen.queryByRole("status")).toBeTruthy()
      act(() => { vitest.advanceTimersByTime(1000) })
      expect(screen.queryByRole("status")).toBeNull()
    } finally { vitest.useRealTimers() }
  })

  it("notice clears on the first scan", async () => {
    render(<GroceryCheckout deviceId="dev1" notice={vi.sessionExpired} />)
    await act(async () => {})
    scan(milk.barcode)
    await screen.findByText("Sữa")
    expect(screen.queryByRole("status")).toBeNull()
  })
})
