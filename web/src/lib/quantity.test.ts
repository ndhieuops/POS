import { describe, expect, it } from "vitest"
import { parseQtyMilli } from "./quantity"

describe("parseQtyMilli", () => {
  it("parses", () => {
    expect(parseQtyMilli("1,2")).toBe(1200)
    expect(parseQtyMilli("1.2")).toBe(1200)
    expect(parseQtyMilli("3")).toBe(3000)
    expect(parseQtyMilli("0,001")).toBe(1)
  })
  it("rejects", () => {
    expect(parseQtyMilli("0")).toBeNull()
    expect(parseQtyMilli("")).toBeNull()
    expect(parseQtyMilli("abc")).toBeNull()
    expect(parseQtyMilli("-1")).toBeNull()
  })
})
