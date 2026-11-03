import { describe, expect, it } from "vitest"
import { parseDong } from "./parseDong"

describe("parseDong", () => {
  it("accepts thousands groups and plain digits", () => {
    expect(parseDong("3.600")).toBe(3600)
    expect(parseDong("18000")).toBe(18000)
    expect(parseDong("1.234.567")).toBe(1234567)
  })
  it("rejects misplaced dots", () => {
    expect(parseDong("3.6")).toBeNull()
    expect(parseDong("36.00")).toBeNull()
    expect(parseDong("")).toBeNull()
    expect(parseDong("abc")).toBeNull()
  })
})
