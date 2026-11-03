import { useEffect, useRef } from "react"

/** Calls onIdle after `ms` without keydown or pointerdown (scanner input arrives as keydown). */
export function useIdleTimeout(ms: number, onIdle: () => void): void {
  const cb = useRef(onIdle)
  cb.current = onIdle

  useEffect(() => {
    let timer = setTimeout(() => cb.current(), ms)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => cb.current(), ms)
    }
    window.addEventListener("keydown", reset, true)
    window.addEventListener("pointerdown", reset, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("keydown", reset, true)
      window.removeEventListener("pointerdown", reset, true)
    }
  }, [ms])
}
