import { afterEach, describe, expect, it } from "vitest"
import { getLoginId, randomId } from "./deviceId"

const ID_RE = /^[A-Za-z0-9-]{1,64}$/

describe("deviceId", () => {
  const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID")
  afterEach(() => {
    if (original) Object.defineProperty(crypto, "randomUUID", original)
    localStorage.clear()
  })

  it("getLoginId works without crypto.randomUUID (plain HTTP on a LAN IP)", () => {
    localStorage.clear()
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true, writable: true })
    expect(crypto.randomUUID).toBeUndefined()
    const id = getLoginId()
    expect(id).toMatch(ID_RE)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(getLoginId()).toBe(id)
  })

  it("randomId gives distinct ids", () => {
    expect(randomId()).not.toBe(randomId())
  })
})
