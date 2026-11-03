import { vi } from "../i18n/vi"

export type Floor = "floor1" | "floor4"
export type Service = "grocery" | "tea" | "pub"
export type Location = string

export interface ProductOut {
  id: number
  barcode: string
  name: string
  unit: string
  sell_price: number
  track_stock: boolean
  stock_qty_milli: number | null
}
export interface ProductOwnerOut extends ProductOut {
  last_cost: number | null
  location: string
  active: boolean
}
export interface Device { id: string; name: string; floor: Floor }
export interface SaleLineIn {
  product_id?: number | null
  name: string
  unit: string
  qty_milli: number
  unit_price: number
  note?: string | null
}
export interface SaleOut {
  id: number
  status: string
  total: number
  lines: Array<Record<string, unknown>>
  payment_ref?: string | null
  qr_payload?: string | null
  payment_method?: string | null
  confirmed_via?: string | null
  paid_at?: string | null
  business_day?: string | null
}
export interface SetupBody {
  shop_name: string
  owner_pin: string
  bank_bin: string
  bank_account_no: string
  bank_account_name: string
}
export interface ReceiveBody {
  barcode: string
  location: string
  qty: number
  unit_cost: number
  name?: string
  sell_price?: number
  unit?: string
}
export interface ReceiveOut {
  product: ProductOwnerOut
  stock_qty_milli: number
  created: boolean
}

export class ApiError extends Error {
  status: number
  detail: string
  body: any
  constructor(status: number, detail: string, body: any = null) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
    this.body = body
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, vi.networkError, null)
  }
  if (res.status === 204) return null as T
  let parsed: any = null
  try {
    parsed = await res.json()
  } catch {
    parsed = null
  }
  if (!res.ok) {
    const detail = typeof parsed?.detail === "string" ? parsed.detail : vi.networkError
    throw new ApiError(res.status, detail, parsed)
  }
  return parsed as T
}

const enc = encodeURIComponent

export const api = {
  setupStatus: () => request<{ configured: boolean }>("GET", "/setup/status"),
  setup: (body: SetupBody) => request<unknown>("POST", "/setup", body),
  ownerLogin: (pin: string, deviceId: string) =>
    request<unknown>("POST", "/owner/login", { pin, device_id: deviceId }),
  ownerLogout: () => request<unknown>("POST", "/owner/logout"),
  getDevice: (id: string) => request<Device>("GET", `/devices/${enc(id)}`),
  registerDevice: (name: string, floor: Floor) =>
    request<Device>("POST", "/owner/devices", { name, floor }),
  lookupBarcode: (code: string, location: Location = "grocery") =>
    request<ProductOut>("GET", `/products/by-barcode/${enc(code)}?location=${enc(location)}`),
  ownerLookupBarcode: (code: string, location: Location) =>
    request<ProductOwnerOut>("GET", `/owner/products/by-barcode/${enc(code)}?location=${enc(location)}`),
  createProduct: (body: Record<string, unknown>) =>
    request<ProductOwnerOut>("POST", "/owner/products", body),
  receive: (body: ReceiveBody) => request<ReceiveOut>("POST", "/owner/receipts", body),
  createSale: (body: { device_id: string; service: Service; lines: SaleLineIn[] }) =>
    request<SaleOut>("POST", "/sales", body),
  requestQr: (id: number) => request<SaleOut>("POST", `/sales/${id}/request-qr`),
  confirm: (id: number, method: "bank_qr" | "cash") =>
    request<SaleOut>("POST", `/sales/${id}/confirm`, { method }),
  pendingSale: (deviceId: string) =>
    request<SaleOut | null>("GET", `/devices/${enc(deviceId)}/pending-sale`),
}
