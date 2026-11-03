/** Parse a đồng amount: plain digits or dot-separated thousands groups ("3.600" -> 3600). Null otherwise. */
export function parseDong(input: string): number | null {
  const s = input.trim()
  if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(s)) return null
  const n = parseInt(s.replace(/\./g, ""), 10)
  return Number.isSafeInteger(n) ? n : null
}
