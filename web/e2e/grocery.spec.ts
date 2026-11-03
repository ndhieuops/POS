import { expect, test } from "@playwright/test"
import { vi } from "../src/i18n/vi"

const BARCODE = "8934563138165"
const PIN = "2468"

async function ownerPin(page: import("@playwright/test").Page) {
  const dlg = page.getByRole("dialog", { name: vi.enterPin })
  await dlg.getByLabel(vi.ownerPin).fill(PIN)
  await dlg.getByRole("button", { name: vi.confirm }).click()
  await expect(dlg).toBeHidden()
}

test("grocery flow: setup, receive, scan, QR, reload, confirm, stock 9", async ({ page }) => {
  // First-run setup
  await page.goto("/")
  // Served from a LAN IP over plain HTTP: not a secure context, like a real floor screen.
  const host = process.env.POS_E2E_HOST ?? "127.0.0.1"
  if (host !== "127.0.0.1") expect(await page.evaluate(() => window.isSecureContext)).toBe(false)
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByLabel(vi.shopName).fill("Tạp hóa Test")
  await page.getByLabel(vi.ownerPinNew).fill(PIN)
  await page.getByLabel(vi.bankBin).fill("970436")
  await page.getByLabel(vi.bankAccountNo).fill("0123456789")
  await page.getByLabel(vi.bankAccountName).fill("NGUYEN VAN A")
  await page.getByRole("button", { name: vi.save }).click()

  // Bind device to floor 1
  await expect(page).toHaveURL(/\/device$/)
  await ownerPin(page)
  await page.getByLabel(vi.deviceName).fill("Quầy 1")
  await page.getByRole("button", { name: vi.floor1 }).click()
  await page.getByRole("button", { name: vi.registerDevice }).click()

  // R14: a floor-1 device skips the one-option picker and lands on grocery
  await expect(page).toHaveURL(/\/grocery$/)
  await expect(page.getByRole("heading", { name: vi.chooseService })).toHaveCount(0)

  // Receive goods (owner PIN)
  await page.getByRole("button", { name: vi.receiveGoods }).click()
  await ownerPin(page)
  await expect(page).toHaveURL(/\/receive$/)
  await page.getByLabel(vi.barcodeInput).fill(BARCODE)
  await page.getByLabel(vi.barcodeInput).press("Enter")
  await page.getByLabel(vi.productName).fill("Mì Hảo Hảo")
  await page.getByLabel(vi.sellPrice).fill("4.500")
  await page.getByLabel(vi.quantity).fill("10")
  await page.getByLabel(vi.costPrice).fill("3.600")
  await page.getByRole("button", { name: vi.saveNewProduct }).click()
  await expect(page.getByRole("status")).toContainText(vi.received)
  await page.getByRole("button", { name: vi.backToSelling }).click()
  await expect(page).toHaveURL(/\/grocery$/)

  // Scan at scanner speed (< 50 ms between keys), then Enter
  await page.locator("body").click()
  await page.keyboard.type(BARCODE, { delay: 10 })
  await page.keyboard.press("Enter")
  await expect(page.getByText("Mì Hảo Hảo")).toBeVisible()
  await expect(page.getByText("4.500đ").first()).toBeVisible()

  // QR payment: dialog, no cancel
  await page.getByRole("button", { name: vi.payQr }).click()
  const qr = page.getByRole("dialog")
  await expect(qr).toBeVisible()
  await expect(qr.getByRole("button", { name: vi.cancel })).toHaveCount(0)
  await expect(qr.getByRole("button", { name: vi.moneyReceived })).toBeVisible()

  // Reload: pending sale restored
  await page.reload()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("button", { name: vi.moneyReceived })).toBeVisible()
  const qr2 = page.getByRole("dialog")
  await expect(qr2.getByRole("button", { name: vi.cancel })).toHaveCount(0)
  await expect(qr2.getByRole("img", { name: vi.qrCodeLabel }).locator("svg")).toBeVisible()
  await expect(qr2.getByText("4.500đ").first()).toBeVisible()

  // Confirm payment: cart empty
  await page.getByRole("button", { name: vi.moneyReceived }).click()
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page.getByText(vi.emptyCart)).toBeVisible()

  // R4: verify stock 9 via the receive screen
  await page.getByRole("button", { name: vi.receiveGoods }).click()
  await ownerPin(page)
  await page.getByLabel(vi.barcodeInput).fill(BARCODE)
  await page.getByLabel(vi.barcodeInput).press("Enter")
  await expect(page.getByTestId("stock")).toContainText(`${vi.inStock}: 9`)
})
