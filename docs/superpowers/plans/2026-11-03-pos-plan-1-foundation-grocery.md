# Home POS — Plan 1: Foundation + Grocery Checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mom and dad can sell grocery items on floor 1 — scan barcodes or type a custom price, pay by a locked VietQR screen (manual "Đã nhận tiền") or cash — and the owner can set up the shop, receive goods with cost prices, and the server runs and backs itself up on the Ubuntu mini server.

**Architecture:** One Python FastAPI server owns a SQLite database and serves a React single-page app built with Vite. Each browser (floor screen) is a registered *device* bound to a floor by the owner. All money is integer đồng; all user-facing text is Vietnamese and lives in one dictionary per side (`web/src/i18n/vi.ts`, `server/pos/messages.py`).

**Tech Stack:** Python 3.12 (system `/usr/bin/python3` on Ubuntu 24.04), FastAPI, SQLAlchemy 2 (sync), Alembic, pydantic v2, pydantic-settings, uvicorn, pytest + httpx. React 18 + TypeScript + Vite, react-router 6, Vitest + Testing Library, Playwright (one e2e). `qrcode.react` for rendering the VietQR payload.

**Spec:** `docs/superpowers/specs/2026-11-03-home-pos-design.md`

### Roadmap (this is plan 1 of 6)
The spec covers several subsystems; each plan below ships working software on its own and gets its own plan file when the previous one is done.
1. **Foundation + grocery checkout** (this file) — §2.1 (floor 1 part), §2.2 except voice, §2.3 manual + cash, §2.4, owner PIN, backups.
2. **Voice entry** — §2.2 voice: PhoWhisper on server, Vietnamese transcript parser, loose products.
3. **Floor 4 operations** — §2.5, §2.6, §2.8, §2.9: menu/stock, tables & bills, staff PINs, drawer sessions, voids, bar screen, real-time (SSE).
4. **Customer table QR + loyalty** — §2.7, §2.11: guest-subnet enforcement, phone ordering, stars, rewards, consent, blocking.
5. **Payments automation + receipts** — §2.3 auto detection (SePay polling), §2.13 reconciliation, §2.10 ESC/POS printing.
6. **Owner reporting + remote access** — §2.12, §2.13 report & CSV, Cloudflare Tunnel + Access, password + TOTP 2FA.

## Global Constraints
- Everything user-facing is Vietnamese: screens, buttons, errors, receipts, setup guide (spec §5, owner decision 2026-11-03). No English string may reach a screen; every UI string comes from `web/src/i18n/vi.ts`, every API error `detail` from `server/pos/messages.py`.
- Money is integer đồng everywhere (DB, API, JS). Display format `37.500đ` (dot thousands separator, `đ` suffix, no space).
- Custom price keypad: typed `50` means **50.000đ** (thousands of đồng).
- QR payment screen: **no Cancel**; closes only via "✓ Đã nhận tiền" (big) or "💵 Trả tiền mặt" (small); scanner ignored while open.
- Grocery screen needs no login; owner pages need the owner PIN.
- Selling must work with the internet down; nothing in this plan calls the internet (VietQR payload built locally).
- No inbound router port; server binds the LAN (`0.0.0.0:8080`) only.
- Time zone `Asia/Ho_Chi_Minh`. Business day: a timestamp between 00:00 and 01:59:59 belongs to the previous date.
- Server runs as systemd service on Ubuntu 24.04, N100, must stay under ~500 MB RAM for this plan.
- Nightly DB backup to `POS_BACKUP_DIR`, 30 days kept.

## Review Focus
1. Screen reloaded / power cut while the QR is showing → after reload the same locked QR for the same sale reappears; no way to start a new customer. (Task 6 `test_pending_sale_restored`, Task 8 `restores pending QR on load`.)
2. Barcode scanned while the QR is open → ignored; no item added, no second sale. (Task 8 `ignores scans while QR open`; Task 6 `test_second_sale_blocked_while_pending`.)
3. Selling an item whose stock is 0 → sale is allowed, stock goes negative; checkout never blocks on stock. (Task 6 `test_stock_can_go_negative`.)
4. "Đã nhận tiền" tapped twice (double-tap, laggy touchscreen) → one payment, stock decremented once. (Task 6 `test_confirm_is_idempotent`.)
5. Wrong owner PIN guessed repeatedly on a shared screen → after 5 wrong attempts, PIN login locked for 5 minutes. (Task 2 `test_pin_lockout`.)

---

## File Structure

```
server/
  pyproject.toml
  alembic.ini
  migrations/env.py, migrations/versions/0001_initial.py
  pos/
    main.py          create_app(): routers, static SPA, startup
    config.py        Settings (env POS_DB_PATH, POS_BACKUP_DIR, POS_TZ)
    db.py            engine (WAL), SessionLocal, Base, get_db
    models.py        ORM: Setting, Device, Product, StockReceipt, Sale, SaleLine, PinAttempt
    messages.py      Vietnamese API error strings
    money.py         round_to_500, line_total, format_vnd
    timeutil.py      now(), business_day()
    vietqr.py        crc16_ccitt, build_vietqr_payload
    auth.py          PIN hashing, owner session, require_owner dependency
    setup/routes.py  first-run setup + settings
    devices/routes.py
    catalog/routes.py, catalog/service.py
    receiving/routes.py, receiving/service.py
    sales/routes.py, sales/service.py
  tests/  conftest.py + test_<module>.py per module
web/
  package.json, vite.config.ts, tsconfig.json, index.html, playwright.config.ts
  src/
    main.tsx, App.tsx (routes)
    i18n/vi.ts
    lib/money.ts, lib/quantity.ts
    api/client.ts
    hooks/useBarcodeScanner.ts
    components/QrPaymentModal.tsx, CustomPriceDialog.tsx, OwnerPinDialog.tsx, Keypad.tsx
    pages/FirstRunSetup.tsx, DeviceSetup.tsx, ServicePicker.tsx, GroceryCheckout.tsx, ReceiveGoods.tsx
  e2e/grocery.spec.ts
deploy/
  pos.service, pos-backup.service, pos-backup.timer, backup.sh, install.sh
docs/HUONG-DAN-CAI-DAT.md   (Vietnamese owner setup guide)
```

---

### Task 1: Server skeleton, money and time helpers

**Files:**
- Create: `server/pyproject.toml`, `server/pos/__init__.py`, `server/pos/main.py`, `server/pos/config.py`, `server/pos/money.py`, `server/pos/timeutil.py`, `server/pos/messages.py`
- Test: `server/tests/test_money.py`, `server/tests/test_timeutil.py`, `server/tests/test_health.py`

**Interfaces:**
- Produces: `round_to_500(amount: int) -> int`; `line_total(unit_price: int, qty_milli: int) -> int`; `format_vnd(amount: int) -> str`; `business_day(ts: datetime) -> date`; `now() -> datetime` (aware, Asia/Ho_Chi_Minh); `create_app(settings: Settings | None = None) -> FastAPI`; `GET /api/health -> {"ok": true}`.
- Quantities are `qty_milli: int` everywhere: 1 item = 1000, 1,2 kg = 1200.

- [ ] **Step 1: Create venv and project**

Run: `cd server && /usr/bin/python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'`
`pyproject.toml` deps: fastapi, uvicorn[standard], sqlalchemy>=2, alembic, pydantic>=2, pydantic-settings, `[dev]`: pytest, httpx. Also `git init` already done at repo root.

- [ ] **Step 2: Write failing tests**

```python
# test_money.py
def test_round_to_500():
    assert round_to_500(17250) == 17500   # half-up to nearest 500đ
    assert round_to_500(17240) == 17000
    assert round_to_500(18000) == 18000
def test_line_total_weight():
    assert line_total(15000, 1200) == 18000   # 1,2 kg × 15.000đ
    assert line_total(15000, 1150) == 17500   # 17.250 → 17.500
def test_line_total_count():
    assert line_total(4500, 3000) == 13500    # 3 items, not rounded away
def test_format_vnd():
    assert format_vnd(37500) == "37.500đ"
    assert format_vnd(0) == "0đ"
    assert format_vnd(1250000) == "1.250.000đ"
# test_timeutil.py
def test_business_day_after_midnight():
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    assert business_day(datetime(2026,11,4,1,30,tzinfo=tz)) == date(2026,11,3)
    assert business_day(datetime(2026,11,4,2,0,tzinfo=tz)) == date(2026,11,4)
# test_health.py
def test_health(client): assert client.get("/api/health").json() == {"ok": True}
```

- [ ] **Step 3: Run tests, expect FAIL (ImportError)**

Run: `cd server && .venv/bin/pytest -q`

- [ ] **Step 4: Implement**

`line_total`: exact `unit_price * qty_milli // 1000` when `qty_milli % 1000 == 0`, otherwise `round_to_500(round_half_up(unit_price * qty_milli / 1000))`. Use integer math (`(unit_price*qty_milli + 500)//1000`) before rounding to 500. `messages.py` starts with `PRODUCT_NOT_FOUND = "Không tìm thấy sản phẩm"`; later tasks add constants here.

- [ ] **Step 5: Run tests, expect PASS** — `cd server && .venv/bin/pytest -q`

- [ ] **Step 6: Commit** — `git add server .gitignore && git commit -m "feat(server): skeleton, money and business-day helpers"`

---

### Task 2: Database, models, first-run setup, owner PIN

**Files:**
- Create: `server/pos/db.py`, `server/pos/models.py`, `server/pos/auth.py`, `server/pos/setup/routes.py`, `server/alembic.ini`, `server/migrations/env.py`, `server/migrations/versions/0001_initial.py`, `server/tests/conftest.py`
- Test: `server/tests/test_setup_auth.py`

**Interfaces:**
- Produces ORM models (all `id` int PK unless noted, timestamps aware):
  - `Setting(key: str PK, value: str)` — keys `shop_name`, `owner_pin_hash`, `bank_bin`, `bank_account_no`, `bank_account_name`.
  - `Device(id: str uuid PK, name: str, floor: Literal["floor1","floor4"], created_at)`
  - `Product(barcode: str|None unique, name, unit: str, sell_price: int, location: Literal["grocery","floor4"], track_stock: bool, stock_qty_milli: int=0, last_cost: int|None, active: bool=True)`
  - `StockReceipt(product_id FK, qty_milli: int, unit_cost: int, received_at)`
  - `Sale(device_id FK, service: Literal["grocery","tea","pub"], status: Literal["open","awaiting_payment","paid"], total: int, payment_method: Literal["bank_qr","cash"]|None, confirmed_via: Literal["manual","auto","cash"]|None, payment_ref: str|None unique, created_at, paid_at|None, business_day: date|None)`
  - `SaleLine(sale_id FK, product_id FK|None, name, unit, qty_milli, unit_price, line_total, unit_cost: int|None, note: str|None)`
  - `PinAttempt(device_id: str, at, ok: bool)`
- `get_db()` FastAPI dependency; `require_owner` dependency raising 401 `messages.OWNER_REQUIRED`.
- Endpoints:
  - `GET /api/setup/status -> {"configured": bool}`
  - `POST /api/setup {shop_name, owner_pin, bank_bin, bank_account_no, bank_account_name}` → 201; 409 `SETUP_DONE` if already configured. PIN must be 4–6 digits else 422 `PIN_FORMAT`.
  - `POST /api/owner/login {pin, device_id}` → sets httpOnly cookie `owner_session` (signed, expires after **5 min idle**, renewed on each owner request); 401 `PIN_WRONG`; 429 `PIN_LOCKED`.
  - `POST /api/owner/logout`; `GET/PUT /api/owner/settings` (bank fields, shop_name).
- PIN hashing: `hashlib.scrypt` with per-hash random salt; session secret generated on first run and stored in `Setting("session_secret")`.

- [ ] **Step 1: Write failing tests** (`conftest.py` provides `client` on a temp-file SQLite DB with migrations applied, and `owner_client` already set up + logged in)

```python
def test_setup_then_status(client):
    assert client.get("/api/setup/status").json() == {"configured": False}
    r = client.post("/api/setup", json=SETUP)   # SETUP owner_pin="2468"
    assert r.status_code == 201
    assert client.get("/api/setup/status").json() == {"configured": True}
    assert client.post("/api/setup", json=SETUP).status_code == 409
def test_pin_format(client):
    assert client.post("/api/setup", json={**SETUP, "owner_pin": "12a4"}).status_code == 422
def test_login_and_owner_route(configured_client):
    assert configured_client.get("/api/owner/settings").status_code == 401
    assert configured_client.post("/api/owner/login", json={"pin":"2468","device_id":"d1"}).status_code == 200
    assert configured_client.get("/api/owner/settings").json()["shop_name"] == SETUP["shop_name"]
def test_pin_lockout(configured_client):
    for _ in range(5):
        assert configured_client.post("/api/owner/login", json={"pin":"0000","device_id":"d1"}).status_code == 401
    r = configured_client.post("/api/owner/login", json={"pin":"2468","device_id":"d1"})
    assert r.status_code == 429 and r.json()["detail"] == messages.PIN_LOCKED
def test_session_idle_expiry(configured_client, freezer):   # use time-machine or monkeypatched now()
    login(); advance(minutes=6)
    assert configured_client.get("/api/owner/settings").status_code == 401
def test_errors_are_vietnamese(configured_client):
    assert configured_client.post("/api/owner/login", json={"pin":"0000","device_id":"d1"}).json()["detail"] == "Mã PIN không đúng"
```
Lockout rule: 5 failed attempts within 5 minutes from the same `device_id` → locked until 5 minutes after the 5th failure.
Message constants: `OWNER_REQUIRED="Cần mã PIN chủ quán"`, `PIN_WRONG="Mã PIN không đúng"`, `PIN_LOCKED="Nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút"`, `PIN_FORMAT="Mã PIN phải gồm 4–6 chữ số"`, `SETUP_DONE="Đã cài đặt rồi"`.

- [ ] **Step 2: Run, expect FAIL** — `.venv/bin/pytest tests/test_setup_auth.py -q`
- [ ] **Step 3: Implement** models, migration `0001_initial` (autogenerate then review), `db.py` with `PRAGMA journal_mode=WAL` and `foreign_keys=ON` on connect, auth and setup routes. Add `time-machine` to dev deps for idle-expiry test (patch `pos.timeutil.now`).
- [ ] **Step 4: Run, expect PASS** — `.venv/bin/pytest -q`
- [ ] **Step 5: Commit** — `git commit -am "feat(server): models, first-run setup, owner PIN with lockout"` (add new files first)

---

### Task 3: Devices bound to floors

**Files:**
- Create: `server/pos/devices/routes.py`
- Test: `server/tests/test_devices.py`

**Interfaces:**
- Consumes: `require_owner`, `Device`.
- Produces: `POST /api/owner/devices {name, floor}` → `{id, name, floor}` (owner only); `GET /api/devices/{id}` → `{id, name, floor}` or 404 `DEVICE_UNKNOWN="Màn hình chưa được cài đặt"`; `PUT /api/owner/devices/{id} {floor}`. Frontend stores `id` in `localStorage["pos_device_id"]` (Task 9).

- [ ] **Step 1: Failing tests** — `test_register_requires_owner` (401 without session), `test_register_and_get` (`floor=="floor1"` round-trips), `test_unknown_device_404` (detail equals `"Màn hình chưa được cài đặt"`), `test_change_floor_requires_owner`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** routes.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(server): devices bound to floors"`

---

### Task 4: Catalogue and barcode lookup

**Files:**
- Create: `server/pos/catalog/routes.py`, `server/pos/catalog/service.py`
- Test: `server/tests/test_catalog.py`

**Interfaces:**
- Produces:
  - `GET /api/products/by-barcode/{code}?location=grocery` → `ProductOut{id, barcode, name, unit, sell_price, track_stock, stock_qty_milli}` (public: grocery screen has no login; **never includes `last_cost`**); 404 `PRODUCT_NOT_FOUND`.
  - `POST /api/owner/products {barcode?, name, unit, sell_price, location, track_stock}` → `ProductOwnerOut` (= ProductOut + `last_cost`); 409 `BARCODE_EXISTS="Mã vạch đã tồn tại"`.
  - `PUT /api/owner/products/{id}` (name, unit, sell_price, active).
  - `GET /api/owner/products?location=&q=` list.
  - `find_by_barcode(db, code: str, location: str) -> Product | None` in service.
- Barcode normalisation: strip whitespace; compare as string (leading zeros kept).

- [ ] **Step 1: Failing tests** — `test_lookup_found`, `test_lookup_not_found_vietnamese` (detail `"Không tìm thấy sản phẩm"`), `test_lookup_hides_cost` (`"last_cost" not in body`), `test_lookup_respects_location` (floor4 product not found with `location=grocery`), `test_leading_zero_barcode` (`"0123456789012"` found as-is), `test_duplicate_barcode_409`, `test_inactive_not_found`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(server): catalogue and barcode lookup"`

---

### Task 5: Receiving goods

**Files:**
- Create: `server/pos/receiving/routes.py`, `server/pos/receiving/service.py`
- Test: `server/tests/test_receiving.py`

**Interfaces:**
- Consumes: `find_by_barcode`, `Product`, `StockReceipt`, `require_owner`.
- Produces: `POST /api/owner/receipts {barcode, location, qty: int, unit_cost: int, name?: str, sell_price?: int, unit?: str="cái"}` → `{product: ProductOwnerOut, stock_qty_milli: int, created: bool}`.
  - Known barcode: add `qty*1000` to stock, set `last_cost=unit_cost`, insert `StockReceipt`.
  - Unknown barcode: `name` and `sell_price` required, else 422 `NEW_PRODUCT_FIELDS="Sản phẩm mới: cần nhập tên và giá bán"`; creates product with `track_stock=True`, then receives.
  - `qty` ≥ 1 and `unit_cost` ≥ 0, else 422 `QTY_INVALID="Số lượng không hợp lệ"`.
- `GET /api/owner/products/by-barcode/{code}?location=` → `ProductOwnerOut` (for prefilling last cost).

- [ ] **Step 1: Failing tests** — `test_receive_known_adds_stock` (12 + 30 → `stock_qty_milli == 42000`, `last_cost == 3600`), `test_receive_new_requires_name_price`, `test_receive_new_creates_product` (`created is True`), `test_receive_requires_owner`, `test_receipt_row_written` (one `StockReceipt` with `unit_cost=3600`).
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(server): receiving goods with cost price"`

---

### Task 6: VietQR payload and sales

**Files:**
- Create: `server/pos/vietqr.py`, `server/pos/sales/routes.py`, `server/pos/sales/service.py`
- Test: `server/tests/test_vietqr.py`, `server/tests/test_sales.py`

**Interfaces:**
- Produces:
  - `crc16_ccitt(data: bytes) -> int` (CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflect, xorout 0).
  - `build_vietqr_payload(bank_bin: str, account_no: str, amount: int, ref: str) -> str` — EMVCo string: `000201` + `010212` + tag 38 { `00` `A000000727`, `01` { `00` bank_bin, `01` account_no }, `02` `QRIBFTTA` } + `5303704` + tag 54 amount + `5802VN` + tag 62 { `08` ref } + `6304` + 4-hex-uppercase CRC computed over everything before it including `6304`. Each field is `ID(2) + len(2, zero-padded) + value`.
  - `payment_ref(sale_id: int) -> str` = `f"POS{sale_id:06d}"`.
  - `SaleIn{device_id, service, lines: [LineIn{product_id?: int, name: str, unit: str, qty_milli: int, unit_price: int, note?: str}]}`
  - `SaleOut{id, status, total, lines, payment_ref?, qr_payload?, payment_method?}`
  - `POST /api/sales` (SaleIn) → SaleOut status `open`. 409 `PENDING_PAYMENT="Đang chờ thanh toán đơn trước"` + `sale` field when the device already has an `awaiting_payment` sale. Server recomputes every `line_total` with `money.line_total` and `total` as their sum; for lines with `product_id`, `unit_price` and `name` come from the DB, not the client. 422 `CART_EMPTY="Giỏ hàng trống"` when no lines; 422 `QTY_INVALID` when `qty_milli <= 0`.
  - `POST /api/sales/{id}/request-qr` → status `awaiting_payment`, sets `payment_ref`, returns `qr_payload`.
  - `POST /api/sales/{id}/confirm {method: "bank_qr"|"cash"}` → status `paid`, `paid_at`, `business_day`, `payment_method`, `confirmed_via` (`"manual"` for bank_qr, `"cash"` for cash); decrements `stock_qty_milli` of tracked products by line `qty_milli`; copies `Product.last_cost` into `SaleLine.unit_cost`. Confirm on an already-paid sale returns 200 with the same sale and changes nothing.
  - `GET /api/devices/{id}/pending-sale` → SaleOut (awaiting_payment, with `qr_payload`) or 204.
- Cash without QR: client calls `POST /api/sales` then `confirm {method:"cash"}`.

- [ ] **Step 1: Failing tests**

```python
def test_crc_check_value():
    assert crc16_ccitt(b"123456789") == 0x29B1
def test_payload_shape():
    p = build_vietqr_payload("970436", "0123456789", 37500, "POS000012")
    assert p.startswith("000201010212")
    assert "0010A000000727" in p and "0208QRIBFTTA" in p
    assert "540537500" in p and "5802VN" in p and "0809POS000012" in p
    assert p[-8:-4] == "6304" and p[-4:] == f"{crc16_ccitt(p[:-4].encode()):04X}"
def test_totals_server_side(device):   # client sends wrong unit_price for product line → ignored
def test_custom_price_line(device):    # product_id None, unit_price 50000, qty_milli 1000, note kept → total 50000
def test_second_sale_blocked_while_pending(device):  # create+request-qr, then POST /api/sales → 409, detail PENDING_PAYMENT
def test_pending_sale_restored(device):  # after request-qr, GET pending-sale returns same id and qr_payload
def test_confirm_decrements_stock(device):  # stock 42000, sell 3 → 39000
def test_stock_can_go_negative(device):   # stock 0, sell 1 → 200, stock -1000
def test_confirm_is_idempotent(device):   # confirm twice → stock decremented once, both 200
def test_cash_sale(device):               # confirm cash → payment_method "cash", confirmed_via "cash"
def test_unit_cost_snapshot(device):      # SaleLine.unit_cost == product.last_cost at sale time
def test_business_day_set(device, at_0130) # paid at 01:30 Nov 4 → business_day 2026-11-03
```
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — confirm runs in one transaction with `SELECT ... ` of the sale row; check status before mutating (idempotency).
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(server): VietQR payload and sales with locked pending payment"`

---

### Task 7: Web skeleton, Vietnamese dictionary, helpers, scanner hook

**Files:**
- Create: `web/package.json`, `web/vite.config.ts` (dev proxy `/api` → `http://localhost:8080`), `web/tsconfig.json`, `web/index.html` (`<html lang="vi">`), `web/src/main.tsx`, `web/src/App.tsx`, `web/src/i18n/vi.ts`, `web/src/lib/money.ts`, `web/src/lib/quantity.ts`, `web/src/api/client.ts`, `web/src/hooks/useBarcodeScanner.ts`
- Test: `web/src/lib/money.test.ts`, `web/src/lib/quantity.test.ts`, `web/src/hooks/useBarcodeScanner.test.ts`, `web/src/i18n/vi.test.ts`

**Interfaces:**
- Produces:
  - `formatVnd(amount: number): string` — same output as server `format_vnd`.
  - `thousandsToDong(typed: string): number` — `"50"` → `50000`, `""` → `0`.
  - `parseQtyMilli(input: string): number | null` — `"1,2"` → `1200`, `"1.2"` → `1200`, `"3"` → `3000`, `"0"`/`""`/`"abc"` → `null`.
  - `vi` object (typed `as const`) — all UI strings. Keys used by later tasks: `appTitle, chooseService, grocery, teaIceCream, pub, changeService, scanOrType, notFound, customPrice, amountThousands, note, addToCart, total, payQr, payCash, moneyReceived ("✓ Đã nhận tiền"), payCashSmall ("💵 Trả tiền mặt"), waitingTransfer ("Chờ khách chuyển khoản…"), scannerPaused ("Máy quét tạm dừng cho đến khi xác nhận"), receiveGoods ("Nhập hàng"), quantity, costPrice, sellPrice, productName, newProduct, save, ownerPin, enterPin, setupTitle, shopName, bankBin, bankAccountNo, bankAccountName, deviceSetup, floor1 ("Tầng 1"), floor4 ("Tầng 4"), comingSoon ("Sắp có"), emptyCart ("Giỏ hàng trống"), remove, networkError ("Mất kết nối với máy chủ")`.
  - `api` in `client.ts`: typed functions for every endpoint in Tasks 2–6, named `setupStatus, setup, ownerLogin, ownerLogout, getDevice, registerDevice, lookupBarcode, ownerLookupBarcode, createProduct, receive, createSale, requestQr, confirm, pendingSale`; errors throw `ApiError{status, detail}` where `detail` is the server's Vietnamese message.
  - `useBarcodeScanner(onScan: (code: string) => void, enabled: boolean): void` — a scan is ≥ 6 printable chars each arriving < 50 ms after the previous, terminated by `Enter`; scans are captured even when an input has focus (preventDefault on that Enter); when `enabled` is false keystrokes are ignored.

- [ ] **Step 1: Scaffold** — `npm create vite@latest web -- --template react-ts`, then add react-router-dom, qrcode.react, vitest, @testing-library/react, jsdom, @playwright/test.
- [ ] **Step 2: Failing tests**

```ts
expect(formatVnd(37500)).toBe("37.500đ"); expect(formatVnd(1250000)).toBe("1.250.000đ")
expect(thousandsToDong("50")).toBe(50000)
expect(parseQtyMilli("1,2")).toBe(1200); expect(parseQtyMilli("abc")).toBeNull()
// scanner: 13 keydowns 10 ms apart then Enter → onScan("8934563138165") once
// scanner: same keys 200 ms apart → onScan not called
// scanner: enabled=false → not called
// vi.test.ts: every value in vi is a non-empty string; no value equals its key
```
- [ ] **Step 3: Run, expect FAIL** — `cd web && npx vitest run`
- [ ] **Step 4: Implement**
- [ ] **Step 5: Run, expect PASS**
- [ ] **Step 6: Commit** — `git commit -m "feat(web): skeleton, Vietnamese strings, money/qty helpers, scanner hook"`

---

### Task 8: Grocery checkout screen with locked QR and custom price

**Files:**
- Create: `web/src/pages/GroceryCheckout.tsx`, `web/src/components/QrPaymentModal.tsx`, `web/src/components/CustomPriceDialog.tsx`, `web/src/components/Keypad.tsx`
- Test: `web/src/pages/GroceryCheckout.test.tsx`, `web/src/components/QrPaymentModal.test.tsx`, `web/src/components/CustomPriceDialog.test.tsx`

**Interfaces:**
- Consumes: `api`, `vi`, `formatVnd`, `thousandsToDong`, `useBarcodeScanner`, `localStorage["pos_device_id"]`.
- Produces: `<GroceryCheckout deviceId={string} />`; `<QrPaymentModal sale={SaleOut} onPaid={(sale) => void} />` (no `onClose` prop exists); `<CustomPriceDialog onAdd={(line: {name, unitPrice, note}) => void} onClose />`.
- Behaviour (spec §2.2–2.3): scan → lookup → add or +1; − / + / remove; total in large type; unknown barcode shows `vi.notFound` with a button opening CustomPriceDialog; custom price line name defaults to `vi.customPrice` when no note; "Thanh toán QR" → `POST /api/sales` + `request-qr` → modal; "Tiền mặt" → create + confirm cash → cart cleared. Modal shows total, QR (`qrcode.react`, ≥ 240 px), `vi.waitingTransfer`, big `vi.moneyReceived`, small `vi.payCashSmall`, `vi.scannerPaused`; Escape and backdrop clicks do nothing. On mount the page calls `GET pending-sale`; if one exists the modal opens immediately. Buttons disable while a request is in flight.

- [ ] **Step 1: Failing tests** (mock `api`)
  - `QrPaymentModal`: `queryByRole("button", {name: /hủy|cancel|đóng/i})` is null; pressing Escape keeps it open; clicking "✓ Đã nhận tiền" calls `confirm(id, "bank_qr")` once even when clicked twice quickly; clicking "💵 Trả tiền mặt" calls `confirm(id, "cash")`.
  - `CustomPriceDialog`: typing `5`,`0` shows `"50.000đ"`; Add emits `unitPrice: 50000` and the note text.
  - `GroceryCheckout`: `adds scanned item` (simulated scan → row with name and `"4.500đ"`); `scanning same item twice gives qty 2`; `unknown barcode shows Không tìm thấy sản phẩm`; `ignores scans while QR open` (scan during modal → lookup not called); `restores pending QR on load` (pending-sale mock returns sale → modal visible on first render); `cash sale clears cart`; `empty cart disables pay buttons`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — touch-first layout from mockup `screens-v1.html`/`qr-v3.html`: buttons ≥ 56 px tall, total ≥ 40 px font.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(web): grocery checkout, locked QR modal, custom price"`

---

### Task 9: Owner flows — first-run setup, PIN, device setup, service picker, receive goods

**Files:**
- Create: `web/src/pages/FirstRunSetup.tsx`, `web/src/pages/DeviceSetup.tsx`, `web/src/pages/ServicePicker.tsx`, `web/src/pages/ReceiveGoods.tsx`, `web/src/components/OwnerPinDialog.tsx`
- Modify: `web/src/App.tsx` (routes)
- Test: `web/src/App.test.tsx`, `web/src/pages/ReceiveGoods.test.tsx`, `web/src/pages/ServicePicker.test.tsx`

**Interfaces:**
- Consumes: `api`, `vi`, `useBarcodeScanner`, `<GroceryCheckout>`.
- Routing rules in `App`: setup not configured → `/setup`; no `pos_device_id` or 404 device → `/device` (asks owner PIN, then name + floor, stores id); device `floor1` → `ServicePicker` shows only **Tạp hóa** (Grocery) and enters `/grocery`; device `floor4` → picker shows **Trà & Kem** and **Pub** with the time-matching one highlighted (18:00–22:00 Trà & Kem, 22:00–02:00 Pub) and both lead to a `vi.comingSoon` page (built in plan 3). "Nhập hàng" button on the grocery screen → `OwnerPinDialog` → `/receive`. Owner pages return to the selling screen after 5 min idle (server session expiry → 401 → redirect).
- `<OwnerPinDialog onSuccess={() => void} onClose />` shows server `detail` text on 401/429.

- [ ] **Step 1: Failing tests**
  - `App`: `unconfigured goes to setup`; `unknown device goes to device setup`; `floor1 device sees only Tạp hóa`.
  - `ServicePicker`: at 19:00 "Trà & Kem" has `aria-current="true"`; at 23:30 and at 01:00 "Pub" does.
  - `ReceiveGoods`: known barcode prefills cost `3.600` and shows current stock; unknown barcode shows name + selling price fields; submit calls `api.receive` with `qty: 30, unit_cost: 3600`; server 422 detail shown verbatim.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** — layouts per mockup `receive-v1.html`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(web): setup, device binding, service picker, receive goods"`

---

### Task 10: Serve SPA, e2e, deploy and nightly backup

**Files:**
- Modify: `server/pos/main.py` (serve `web/dist` with SPA fallback for non-`/api` paths)
- Create: `web/e2e/grocery.spec.ts`, `web/playwright.config.ts`, `deploy/pos.service`, `deploy/backup.sh`, `deploy/pos-backup.service`, `deploy/pos-backup.timer`, `deploy/install.sh`, `docs/HUONG-DAN-CAI-DAT.md`
- Test: `server/tests/test_spa.py`, `deploy/test_backup.sh`

**Interfaces:**
- `pos.service`: `User=pos`, `WorkingDirectory=/opt/pos/server`, `ExecStart=/opt/pos/server/.venv/bin/uvicorn pos.main:create_app --factory --host 0.0.0.0 --port 8080`, `Environment=POS_DB_PATH=/var/lib/pos/pos.db POS_BACKUP_DIR=/var/backups/pos`, `Restart=always`, `MemoryMax=600M`.
- `backup.sh`: `sqlite3 "$POS_DB_PATH" ".backup '$POS_BACKUP_DIR/pos-$(date +%F).db'"` then delete `pos-*.db` older than 30 days. Timer: daily `02:30` local, `Persistent=true`.
- `install.sh`: `apt install -y sqlite3 python3-venv nodejs npm` if missing, creates user `pos`, dirs, venv, runs `alembic upgrade head`, builds web, installs units, enables service + timer. Idempotent.
- `HUONG-DAN-CAI-DAT.md`: Vietnamese step-by-step for the owner — install, open `http://<ip-máy-chủ>:8080` on each floor screen, first-run setup (shop name, PIN, bank BIN + account), bind screens to floors, plug in USB scanner, where backups live, how to change the backup folder to a USB drive.

- [ ] **Step 1: Failing tests**
  - `test_spa.py`: `GET /grocery` returns `index.html` (200, `text/html`); `GET /api/nope` returns 404 JSON, not HTML.
  - `deploy/test_backup.sh`: on a temp DB + temp dir with a fake 31-day-old `pos-*.db`, running `backup.sh` creates today's file and deletes the old one (exit 0).
  - `e2e/grocery.spec.ts` (against `vite build` + uvicorn on a temp DB): setup → bind device Tầng 1 → receive barcode `8934563138165` (name "Mì Hảo Hảo", sell 4.500, cost 3.600, qty 10) → on grocery screen type the barcode via keyboard at scanner speed → "Thanh toán QR" → QR visible, no cancel button → reload page → QR still visible → "✓ Đã nhận tiền" → cart empty; owner product list shows stock 9.
- [ ] **Step 2: Run, expect FAIL** — `cd server && .venv/bin/pytest tests/test_spa.py -q`; `bash deploy/test_backup.sh`; `cd web && npx playwright test`
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run all, expect PASS** — `cd server && .venv/bin/pytest -q && cd ../web && npx vitest run && npx playwright test && bash ../deploy/test_backup.sh`
- [ ] **Step 5: Commit** — `git commit -m "feat: serve SPA, e2e grocery flow, systemd deploy, nightly backup"`

---

## Done when
- All server, web and e2e tests pass with the command in Task 10 Step 4.
- On the mini server, `sudo bash deploy/install.sh` brings up the service at `http://<server-ip>:8080`, a floor-1 screen can complete the e2e flow by hand with a real USB scanner and a real bank app scanning the QR (amount pre-filled correctly), and `/var/backups/pos/` gets a file the next morning.
