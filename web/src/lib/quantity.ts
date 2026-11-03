/** Parse "1,2" / "1.2" / "3" into thousandths (milli) of a unit. Null if invalid or <= 0. */
export function parseQtyMilli(input: string): number | null {
  const s = input.trim().replace(",", ".")
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null
  const milli = Math.round(parseFloat(s) * 1000)
  return milli > 0 ? milli : null
}
