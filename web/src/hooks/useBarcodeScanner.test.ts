import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { renderHook } from "@testing-library/react"
import { useBarcodeScanner } from "./useBarcodeScanner"

const CODE = "8934563138165"

function key(k: string, target: EventTarget = window) {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}
function type(code: string, gap: number) {
  for (const c of code) {
    key(c)
    vitest.advanceTimersByTime(gap)
  }
}

describe("useBarcodeScanner", () => {
  beforeEach(() => vitest.useFakeTimers())
  afterEach(() => vitest.useRealTimers())

  it("fires on fast burst + Enter", () => {
    const onScan = vitest.fn()
    renderHook(() => useBarcodeScanner(onScan, true))
    type(CODE, 10)
    key("Enter")
    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith(CODE)
  })
  it("ignores slow typing", () => {
    const onScan = vitest.fn()
    renderHook(() => useBarcodeScanner(onScan, true))
    type(CODE, 200)
    key("Enter")
    expect(onScan).not.toHaveBeenCalled()
  })
  it("ignores when disabled", () => {
    const onScan = vitest.fn()
    renderHook(() => useBarcodeScanner(onScan, false))
    type(CODE, 10)
    key("Enter")
    expect(onScan).not.toHaveBeenCalled()
  })
  it("ignores short bursts", () => {
    const onScan = vitest.fn()
    renderHook(() => useBarcodeScanner(onScan, true))
    type("12345", 10)
    key("Enter")
    expect(onScan).not.toHaveBeenCalled()
  })
  it("captures while an input is focused and prevents Enter default", () => {
    const onScan = vitest.fn()
    renderHook(() => useBarcodeScanner(onScan, true))
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    for (const c of CODE) {
      key(c, input)
      vitest.advanceTimersByTime(10)
    }
    const e = key("Enter", input)
    expect(onScan).toHaveBeenCalledWith(CODE)
    expect(e.defaultPrevented).toBe(true)
    input.remove()
  })
  it("slow gap restarts buffer", () => {
    const onScan = vitest.fn()
    renderHook(() => useBarcodeScanner(onScan, true))
    type("999", 200)
    type(CODE, 10)
    key("Enter")
    expect(onScan).toHaveBeenCalledWith(CODE)
  })
})
