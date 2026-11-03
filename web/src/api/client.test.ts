import { afterEach, describe, expect, it, vi as vitest } from "vitest"
import { api, ApiError } from "./client"
import { vi } from "../i18n/vi"

function mockFetch(res: Response | Error) {
  vitest.stubGlobal("fetch", vitest.fn(() => (res instanceof Error ? Promise.reject(res) : Promise.resolve(res))))
}
async function err(p: Promise<unknown>): Promise<ApiError> {
  try { await p } catch (e) { return e as ApiError }
  throw new Error("no throw")
}

describe("api client", () => {
  afterEach(() => vitest.unstubAllGlobals())

  it("204 -> null", async () => {
    mockFetch(new Response(null, { status: 204 }))
    expect(await api.pendingSale("d1")).toBeNull()
  })
  it("409 keeps detail and body.sale", async () => {
    mockFetch(new Response(JSON.stringify({ detail: "Đang chờ thanh toán", sale: { id: 5 } }), { status: 409 }))
    const e = await err(api.requestQr(5))
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(409)
    expect(e.detail).toBe("Đang chờ thanh toán")
    expect((e.body as { sale: { id: number } }).sale.id).toBe(5)
  })
  it("fetch rejects -> status 0 networkError", async () => {
    mockFetch(new TypeError("fail"))
    const e = await err(api.setupStatus())
    expect(e.status).toBe(0)
    expect(e.detail).toBe(vi.networkError)
  })
  it("500 HTML -> serverError", async () => {
    mockFetch(new Response("<html>oops</html>", { status: 500 }))
    const e = await err(api.setupStatus())
    expect(e.status).toBe(500)
    expect(e.detail).toBe(vi.serverError)
  })
})
