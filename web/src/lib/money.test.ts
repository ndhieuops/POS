import { describe, expect, it } from "vitest"
import { formatVnd, thousandsToDong } from "./money"

describe("money", () => {
  it("formats", () => {
    expect(formatVnd(37500)).toBe("37.500đ")
    expect(formatVnd(1250000)).toBe("1.250.000đ")
    expect(formatVnd(0)).toBe("0đ")
  })
  it("thousandsToDong", () => {
    expect(thousandsToDong("50")).toBe(50000)
    expect(thousandsToDong("")).toBe(0)
  })
})
