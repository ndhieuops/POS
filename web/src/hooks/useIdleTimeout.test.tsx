import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { useIdleTimeout } from "./useIdleTimeout"

function Probe({ onIdle }: { onIdle: () => void }) {
  useIdleTimeout(300000, onIdle)
  return null
}
const min = (n: number) => act(() => { vitest.advanceTimersByTime(n * 60000) })

beforeEach(() => vitest.useFakeTimers())
afterEach(() => { cleanup(); vitest.useRealTimers() })

describe("useIdleTimeout", () => {
  it("fires after 5 minutes idle", () => {
    const f = vitest.fn()
    render(<Probe onIdle={f} />)
    min(4)
    expect(f).not.toHaveBeenCalled()
    min(1)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it("keydown and pointerdown at 4 minutes reset the timer", () => {
    const f = vitest.fn()
    render(<Probe onIdle={f} />)
    min(4)
    fireEvent.keyDown(window, { key: "a" })
    min(4)
    expect(f).not.toHaveBeenCalled()
    fireEvent.pointerDown(window)
    min(4)
    expect(f).not.toHaveBeenCalled()
    min(1)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it("stops after unmount", () => {
    const f = vitest.fn()
    const { unmount } = render(<Probe onIdle={f} />)
    unmount()
    min(10)
    expect(f).not.toHaveBeenCalled()
  })
})
