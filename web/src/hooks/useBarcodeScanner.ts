import { useEffect, useRef } from "react"

const MAX_GAP_MS = 50
const MIN_LENGTH = 6

/**
 * USB keyboard-wedge scanner: fast printable keys, then Enter.
 * A scan is >= 6 chars, each < 50 ms after the previous, ended by Enter.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled: boolean): void {
  const cb = useRef(onScan)
  cb.current = onScan

  useEffect(() => {
    if (!enabled) return
    let buffer = ""
    let last = 0

    const onKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      if (e.key === "Enter") {
        const isScan = buffer.length >= MIN_LENGTH && now - last < MAX_GAP_MS
        const code = buffer
        buffer = ""
        if (isScan) {
          e.preventDefault()
          cb.current(code)
        }
        return
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      if (now - last >= MAX_GAP_MS) buffer = ""
      buffer += e.key
      last = now
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [enabled])
}
