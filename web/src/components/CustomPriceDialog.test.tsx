import { afterEach, describe, expect, it, vi as vitest } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { vi } from "../i18n/vi"
import { CustomPriceDialog } from "./CustomPriceDialog"

afterEach(cleanup)

describe("CustomPriceDialog", () => {
  it("typing 5,0 shows 50.000đ and Add emits dong + note", () => {
    const onAdd = vitest.fn()
    render(<CustomPriceDialog onAdd={onAdd} onClose={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "5" }))
    fireEvent.click(screen.getByRole("button", { name: "0" }))
    expect(screen.getByText("50.000đ")).toBeTruthy()
    fireEvent.change(screen.getByLabelText(vi.note), { target: { value: "rau" } })
    fireEvent.click(screen.getByRole("button", { name: vi.addToCart }))
    expect(onAdd).toHaveBeenCalledWith({ name: "rau", unitPrice: 50000, note: "rau" })
  })

  it("focuses the amount area on mount", () => {
    render(<CustomPriceDialog onAdd={() => {}} onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByTestId("custom-amount"))
  })

  it("Add disabled at zero; backspace works", () => {
    render(<CustomPriceDialog onAdd={() => {}} onClose={() => {}} />)
    expect((screen.getByRole("button", { name: vi.addToCart }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "7" }))
    fireEvent.click(screen.getByRole("button", { name: vi.backspace }))
    expect(screen.getByText("0đ")).toBeTruthy()
  })
})
