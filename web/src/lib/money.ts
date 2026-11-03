export function formatVnd(amount: number): string {
  return Math.trunc(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ"
}

/** Keypad input is in thousands of đồng: "50" -> 50000. */
export function thousandsToDong(typed: string): number {
  const n = parseInt(typed.replace(/\D/g, ""), 10)
  return Number.isNaN(n) ? 0 : n * 1000
}
