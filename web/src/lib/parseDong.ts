/** Parse a đồng amount typed with optional dot/space thousands separators ("3.600" -> 3600). Null if invalid. */
export function parseDong(input: string): number | null {
  const s = input.trim().replace(/[.\s]/g, "")
  return /^\d{1,12}$/.test(s) ? parseInt(s, 10) : null
}
