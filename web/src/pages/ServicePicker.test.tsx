import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { vi } from "../i18n/vi"
import { ServicePicker } from "./ServicePicker"

afterEach(cleanup)
// Asia/Ho_Chi_Minh is UTC+7, no DST.
const at = (iso: string) => () => new Date(iso)

function show(iso: string) {
  render(<ServicePicker floor="floor4" now={at(iso)} onPick={() => {}} />)
}

describe("ServicePicker", () => {
  it("highlights Trà & Kem at 19:00", () => {
    show("2026-11-03T12:00:00Z")
    expect(screen.getByRole("button", { name: vi.teaIceCream }).getAttribute("aria-current")).toBe("true")
    expect(screen.getByRole("button", { name: vi.pub }).getAttribute("aria-current")).toBeNull()
  })
  it("highlights Pub at 23:30", () => {
    show("2026-11-03T16:30:00Z")
    expect(screen.getByRole("button", { name: vi.pub }).getAttribute("aria-current")).toBe("true")
    expect(screen.getByRole("button", { name: vi.teaIceCream }).getAttribute("aria-current")).toBeNull()
  })
  it("highlights Pub at 01:00", () => {
    show("2026-11-03T18:00:00Z")
    expect(screen.getByRole("button", { name: vi.pub }).getAttribute("aria-current")).toBe("true")
  })
  it("floor1 shows only Tạp hóa", () => {
    render(<ServicePicker floor="floor1" now={at("2026-11-03T12:00:00Z")} onPick={() => {}} />)
    expect(screen.getByRole("button", { name: "Tạp hóa" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: vi.pub })).toBeNull()
    expect(screen.queryByRole("button", { name: vi.teaIceCream })).toBeNull()
  })
})
