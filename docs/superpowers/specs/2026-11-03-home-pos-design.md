# Home POS — Design

Date: 2026-11-03
Status: draft, awaiting owner approval
Mockups: `.superpowers/brainstorm/*/content/*.html` (screens-v1, qr-v3, no-barcode-v1, receive-v1, report-v1, table-qr-v1)

## 1. Intent and why

The owner is opening two businesses in their own house:

- **Floor 1 — grocery store**, run by the owner's mom and dad.
- **Floor 4 — drinks floor**, run by hired staff:
  - 18:00–22:00: tea, ice cream and similar ("Tea time").
  - 22:00–02:00 every day: an open pub ("Pub").

They want one point-of-sale system they own, running on their own Ubuntu mini server at home, that:

1. Makes checkout fast and hard to get wrong for older parents (scan → total → bank QR → confirm).
2. Keeps stock counts and cost prices so the owner knows real profit.
3. Gives the owner a monthly cash-flow view to see whether the business is growing, reachable from anywhere.
4. Lets hired staff run floor 4 — including customers ordering from their own phones — without seeing money reports or cost prices, and without being able to change prices.

## 2. Goals

### 2.1 Devices and service selection
Devices on the home LAN, all using a browser:

| Device | Where | Shows |
|---|---|---|
| Grocery screen | Floor 1 counter | Grocery selling, receive goods (owner PIN) |
| Floor-4 POS screen | Floor 4 counter | Tea time / Pub selling, tables, payments, drawer |
| Bar screen | Floor 4 bar | Drink queue only |
| Staff phones/tablets (optional) | Floor 4 | Same staff pages as floor-4 POS screen, after PIN login |
| Customer phones | Floor 4, on guest Wi-Fi | Table ordering page only |
| Owner (anywhere) | Internet via Cloudflare | Owner pages only (§2.13) |

- Each counter screen is **set to its floor** (owner setting on that device). The grocery screen offers only Grocery. The floor-4 screen shows a service picker with **Tea & Ice cream** and **Pub**; the one matching the current time is highlighted (Tea 18:00–22:00, Pub 22:00–02:00) but either can be chosen. Changing a device's floor needs the owner PIN.
- A "Change service" control is always reachable from the floor-4 selling screens.

### 2.2 Grocery checkout (floor 1, parents)
- No login. No shift or cash count.
- Barcode scanner adds the product to the cart; scanning it again adds 1. − / + adjust quantity; items can be removed before payment.
- Running total always visible.
- **Unknown barcode** at checkout: shows "Không tìm thấy sản phẩm" with a **Custom price** shortcut; it never blocks the sale.
- **Items without barcode** (fruit, vegetables, loose eggs…):
  - **Voice**: hold a mic button and speak, e.g. "táo xanh mười lăm nghìn một cân". The POS turns it into name + unit price + unit (kg / cái / bó / quả…). It first matches a **loose product the owner has created** (e.g. "Táo xanh", per kg, 15.000đ); if none matches, it becomes a one-off line. For per-kg items a **weight box** appears; the parent reads the scale and types the weight; the POS computes the line total. Every parsed field can be fixed before "Add to cart". Loose products have **no stock count**.
  - **Custom price**: numeric keypad where typing `50` means **50.000đ** (amounts entered in thousands of đồng), plus an optional **note** (e.g. "rau muống + 10 trứng gà") saved with the sale.
- Payment: **Pay by bank QR** (primary) or **Pay by cash**.

### 2.3 QR payment screen (all services)
- Shows the total and a **VietQR** code with the exact amount and a unique payment reference pre-filled.
- The screen is **locked**: no Cancel button, and the barcode scanner is ignored while it is open, so the next customer cannot be started by accident.
- It closes only by:
  1. **Automatic payment detection** — the POS sees the matching incoming bank transfer and closes by itself, recording the sale as bank-paid; or
  2. **"✓ Money received"** (big button) — manual confirmation after the owner's bank speaker announces the money; used when detection is down or slow; or
  3. **"💵 Pay by cash"** (small button) — customer switched to cash; recorded as cash.
- After it closes, a **"Print receipt"** button is offered (§2.10).

### 2.4 Receiving goods
- Owner-only (owner PIN), on either counter screen. Choose stock location: **grocery** or **floor 4**.
- Scan a barcode:
  - **Known product**: shows name, current stock, sell price; enter **quantity received** and **cost price per item** (pre-filled with last cost). Saving adds to stock and records the cost.
  - **New barcode**: also enter **product name** (typed or spoken) and **selling price**.
- Owner can also create products without barcodes (name, unit, sell price) — these are the loose grocery products used by voice matching, and floor-4 menu items.

### 2.5 Floor-4 menu and stock
- Floor 4 has its **own menu and own stock**, separate from grocery.
- Each menu item is tagged **Tea time**, **Pub**, or **Both**; ordering screens (staff and customer) show only items for the active service.
- **Stock tracked only for bottled/packaged items** (beer, soft drinks, packaged snacks). Mixed drinks and scooped ice cream have a price but no stock. No recipes.
- Owner can mark an item **unavailable** (sold out) — it disappears from the customer menu.

### 2.6 Tables and bills (Tea time and Pub)
- Table grid (owner configures table names/count) plus a **"Quầy / pay now"** spot for walk-up sales.
- Staff **open a table** when guests sit; add items; the bill stays **open** until paid. Pay now or pay later — both fine. Staff can move a bill to another table and pay part of the items (split) only if cheap to build; otherwise not required.
- Paying a bill uses the same QR / cash flow (§2.3).
- Open bills at 02:00 are flagged as a warning to staff and owner; never closed silently.
- Tea time works the same as Pub except **no loyalty**.

### 2.7 Customer self-ordering by table QR (floor 4)
- Each table has **one printed QR** (static; reprinting not needed). Scanning it on the **pub guest Wi-Fi** opens the ordering page for that table. The QR may include joining the guest Wi-Fi.
- Flow on the customer's phone:
  1. Shows table name and service. Asks for **phone number**. First-time numbers also tick a **consent box** ("Tôi đồng ý cho quán lưu số điện thoại để tích điểm"). The phone is remembered on that device afterwards.
  2. Menu of items available now; cart; **"Gọi món"**. Loyalty status shown at the top (Pub only): stars balance and progress to the next reward (e.g. "⭐ 42 sao · còn 8 sao nữa đổi 1 Tiger miễn phí").
  3. Status: "Đã gửi — đang chờ nhân viên xác nhận" → "Đang chuẩn bị" → "Đã xong". Also shows the table's running bill and stars to be earned.
  - Customers **do not pay from the phone**; payment goes through staff (§2.3).
- **Anti-abuse (all required):**
  - Ordering page is reachable **only from the guest Wi-Fi** (LAN), never from the internet. A photographed QR is useless off-site.
  - The QR works **only while staff have that table open**; otherwise it shows "Vui lòng gọi nhân viên".
  - **Every customer order must be accepted by staff** (Accept / Reject) before it reaches the bill or the bar. New numbers are labelled "khách mới".
  - Limits: max **10 items per order**; max **1 waiting (unaccepted) order per phone**; server rate-limits order submissions per table and per device.
  - Owner can **block** a phone number.
  - Phone numbers are **not SMS-verified** (no internet dependency, no SMS fees); staff acceptance covers this.

### 2.8 Bar screen (drink queue)
- Bar screen shows accepted items in order of acceptance, grouped by table, with time waiting.
- Bartender taps an item/order **"Xong"** (done); the floor-4 POS screen and the customer's phone show it as ready.
- Every accepted item goes to the queue unless the owner marks a menu item "không qua bar" (e.g. packaged snacks served directly).
- No login needed to view; marking done records nothing financial.

### 2.9 Staff accounts, shifts and cash drawer (floor 4)
- Each hired staff member has their **own account** and **PIN**. Typically 3 on duty (cashier, server, bartender), but people and times change; the system does not enforce fixed roles or fixed shift hours.
- **Staff shift**: each person clocks in / out with their PIN at any time. Orders, acceptances, payments and loyalty redemptions are recorded under the staff member who did them.
- **One cash drawer** with **drawer sessions**:
  - **Open**: a staff member opens the drawer session and enters the starting cash (float).
  - All cash payments on floor 4 go into the current drawer session, whoever took them.
  - **Handover / close**: the staff member closing counts the cash; the POS shows **expected** (float + cash in − cash paid out) vs **counted**; the difference is saved. The next person opens a new session with the counted amount. Final close at end of night.
  - Cash cannot be taken on floor 4 when no drawer session is open.
- **Fixing mistakes**: staff can remove an item from an open bill within **2 minutes** of adding it. After that, or to void/refund a paid sale, or to change a paid sale's payment method, **owner PIN** is required. Every removal/void is recorded with who, when, why, and listed in the owner's report. Voids reverse stock.
- Staff **cannot** see reports, cost prices, profit, or other shifts' drawer counts; **cannot** change prices, menu, rewards, tables, or stock counts. They see selling prices.

### 2.10 Printed receipts
- One receipt printer **on each floor**. Prints only on request ("Print receipt" after payment; reprint from recent sales).
- Contents: shop name, date/time, items, quantities, prices, total, payment method; for Pub, stars earned/used. It is a sales slip, not a tax invoice.

### 2.11 Pub loyalty (Pub only)
- Customer = **phone number**, from table QR ordering or typed by staff at payment. First use requires recorded **consent**.
- **Stars** earned per paid bill; rate set by owner (default **1 star per 10.000đ**). Stars are credited when the bill is paid, to the phone attached to the bill (one phone per bill; staff can change it before payment).
- Owner defines a **reward list**: **% discount** on the bill or a **free drink** (specific menu item), each costing N stars (e.g. 100 ⭐ = 10% off; 50 ⭐ = free Tiger).
- At payment, staff apply at most one reward; stars are deducted; discount/free item appears on the bill and receipt.
- Customer sees balance and progress on the ordering page (§2.7).
- Not used for Tea time or Grocery.

### 2.12 Expenses
- Owner records expenses: date, category (Điện, Lương, Thuê nhà, Nước/Internet, **Nguyên liệu**, Khác — owner can add more), amount, note, and business (Grocery / Floor 4 / Shared).
- **Nguyên liệu** (produce bought for loose grocery sale, tea/syrup/ice cream/ingredients) counts as **goods cost** in the report, because those items have no per-item cost price.

### 2.13 Owner pages and monthly report
- Owner pages: reports, expenses, products/menu/prices, receiving goods, staff accounts, rewards, tables, blocked phones, settings, unmatched payments, voids log, CSV export.
- **Monthly report** (month picker):
  - **Money in**, **Goods cost** (cost price of sold stocked items + Nguyên liệu expenses), **Expenses** (other categories), **Profit** — each vs previous month.
  - **Profit trend**, last 6 months (bar chart).
  - Sales **by service** (Grocery, Tea & Ice cream, Pub) and **cash vs bank QR**.
  - Expense list by category with "+ Add expense".
  - Drawer differences, voids/removals, **unmatched "Money received"** confirmations.
- **Payment reconciliation**: while the internet is up, the server keeps reading the bank feed during opening hours. Any manual "Money received" with no matching transfer within a grace period is listed as **unmatched** for the owner to check.

### 2.14 Roles summary

| Role | Who | Login | Can do |
|---|---|---|---|
| Grocery seller | Mom & dad | none (grocery screen only) | Sell grocery, print receipts |
| Staff | Hired floor-4 staff | own PIN | Floor-4 selling, tables, accept phone orders, payments, drawer sessions, loyalty |
| Bar | Bartender | none on bar screen | Mark drinks done |
| Customer | Pub/tea guests | phone number | Order at an open table, see own stars |
| Owner | The owner | PIN on LAN; password + 2FA remotely | Everything |

## 3. Non-goals
- Electronic VAT invoices / tax-authority integration (see §7).
- Customers paying from their phone inside the ordering page.
- Ordering from outside the guest Wi-Fi; delivery; customer app install.
- Ingredient/recipe stock.
- Loyalty for Grocery or Tea time.
- SMS/OTP verification of phone numbers.
- Multiple shops; cloud database.
- Change calculator for cash; card terminals.

## 4. Anti-goals (failure even if it "works")
- A new grocery customer can be started while a QR payment is unconfirmed.
- Selling stops when the internet is down (only automatic payment detection and remote owner access may degrade).
- Staff can see profit, cost prices or reports, or change prices.
- Selling screens, staff pages or customer ordering reachable from the internet.
- Any inbound port opened on the home router.
- Trolls able to put orders on a bill or flood the bar screen.
- Parents need help to make a normal sale.
- Sales data lost on a disk failure.

## 5. Constraints and decisions

### Decided by the owner
- Ubuntu mini server at home; web app in browsers on the home LAN/Wi-Fi.
- Floor 1 grocery screen; floor 4 POS screen; bar screen with drink queue.
- USB barcode scanners for selling and receiving.
- VietQR bank-transfer payment with automatic detection **and** manual "Money received"; cash accepted. QR screen: no Cancel, only "Money received" (big) and "Pay by cash" (small).
- Voice and custom-price entry for no-barcode items; weight typed from a scale.
- Cost price typed when receiving goods.
- Floor 4: separate menu and stock; stock only for bottled/packaged.
- Hired staff with separate accounts, hidden reports/prices; cash count; shifts flexible; one shared drawer; ~3 staff (cashier, server, bartender).
- Pub loyalty by phone number with stars visible on the customer's phone; rewards are % discount or free drink.
- Table QR self-ordering on a guest Wi-Fi, phone number required, staff acceptance.
- Expenses (electricity, wages, rent…); monthly cash-flow report.
- Receipt printer on both floors, print on request.
- Remote owner access over the internet through the owner's existing **Cloudflare** account, with an owner admin account and **2FA**; no VPN.

### Claude's calls (owner may override)
- **Server** (checked): Intel N100, 4 cores, 16 GB RAM (~8 GB used by other software), ~120 GB free disk, Ubuntu 24.04.
- **Remote access**: **Cloudflare Tunnel** (outbound connection, no router port) publishing **only owner pages** on a hostname; protected by **Cloudflare Access** (owner's email) **and** the app's owner password + **TOTP 2FA** (Google Authenticator-style). All other routes are LAN-only and refused through the tunnel.
- **Network**: customer guest Wi-Fi can reach only the customer ordering page on the server; staff/owner/selling pages refuse requests from the guest Wi-Fi subnet. (Exact router setup is the owner's; the app enforces it by source subnet setting.)
- **Voice** runs locally (PhoWhisper by VinAI, small/base, CPU int8, ≤ ~2 GB RAM). Browser records audio and sends to server. Transcript parsing by deterministic rules (Vietnamese number words, "nghìn/ngàn/k", "cân/ký/kg", "cái", "bó", "quả"…), always human-confirmed.
- **VietQR payload generated locally** (EMVCo/NAPAS) from one house bank account; unique reference per payment in the transfer content.
- **Automatic payment detection** via **SePay** (or Casso), server **polls the provider API over outbound HTTPS** — no webhook.
- **UI language** (owner decision, 2026-11-03): **everything user-facing is Vietnamese** — all screens (grocery, floor 4, bar, customer phone, owner pages), receipts, error messages, consent text, and the owner's setup guide. Large touch targets; amounts as `37.500đ`.
- **Receipt printers**: ESC/POS thermal (58 or 80 mm), network or USB.
- **Data**: SQLite (WAL) on the server; money as integer đồng.
- **Backups**: nightly copy to a second location chosen by owner, 30 days kept.
- **Time**: Asia/Ho_Chi_Minh. Floor-4 business day runs past midnight: 00:00–02:00 belongs to the previous evening for daily totals; monthly report uses business days.
- **Sessions**: owner PIN pages on shared screens time out to the selling screen after a few minutes idle. Customer phones remember their number by cookie.
- **Personal data**: phone numbers only for ordering/loyalty, with consent + timestamp; owner can delete a customer's record (Vietnam Personal Data Protection Law, in force 2026-01-01).

## 6. Left to the builder
- Language, framework, frontend library, layout; must run on the N100 and deploy as systemd service(s) on Ubuntu 24.04.
- Real-time updates mechanism (e.g. WebSocket/SSE) for phone orders, bar queue, and payment detection.
- Exact screen layouts within §2 and the mockups.
- Voice-parsing grammar (examples in §2.2 must work).
- Schema, API, polling intervals, reference-code format, rate-limit numbers beyond those stated.
- SePay vs Casso; secret storage.
- Whether bill split / move table is included (nice to have).

## 7. Open risks and notes
- **Tax / e-invoices**: from 2026 Vietnamese household businesses lose lump-sum tax; some must issue e-invoices from cash registers depending on revenue. Out of scope; owner should check with the local tax office. Every sale keeps a unique id, timestamp, items and amounts so this can be added later.
- **Server already busy**: ~8 GB RAM used by other software.
- **Internet-dependent parts**: payment detection and remote owner access need internet; both degrade gracefully.
- **Alcohol sales and late-hours permits** are the owner's responsibility.
