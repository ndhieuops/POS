import { describe, expect, it } from "vitest"
import { vi } from "./vi"

describe("vi dictionary", () => {
  it("has non-empty string values that differ from their key", () => {
    for (const [k, v] of Object.entries(vi)) {
      expect(typeof v).toBe("string")
      expect(v.length).toBeGreaterThan(0)
      expect(v).not.toBe(k)
    }
  })
  it("has exact required strings", () => {
    expect(vi.moneyReceived).toBe("✓ Đã nhận tiền")
    expect(vi.payCashSmall).toBe("💵 Trả tiền mặt")
    expect(vi.waitingTransfer).toBe("Chờ khách chuyển khoản…")
    expect(vi.scannerPaused).toBe("Máy quét tạm dừng cho đến khi xác nhận")
    expect(vi.floor1).toBe("Tầng 1")
    expect(vi.floor4).toBe("Tầng 4")
    expect(vi.networkError).toBe("Mất kết nối với máy chủ")
  })
})
