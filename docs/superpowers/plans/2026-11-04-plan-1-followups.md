# Plan 1 — follow-ups carried into later plans

Recorded at the end of plan 1 (branch `feat/plan-1-grocery`). Later plans must address or explicitly drop each item.

## Before go-live (owner checks)
- Floor-1 device browser must support `inert` (Chrome/Edge ≥ 102, Safari ≥ 15.5, Firefox ≥ 112). The scanner gate and Enter guard still work without it, but taps behind dialogs rely on it.
- If the floor-1 screen is a touch tablet, the barcode input keeps focus and may pop the on-screen keyboard after each tap. Fix: `inputMode="none"` on the barcode input in `web/src/pages/GroceryCheckout.tsx`.
- Do the plan's "Done when" check by hand: real USB scanner, real bank app scanning the VietQR, on the actual floor-1 device.

## Plan 3 (floor 4 operations, voids)
- Lost cash-confirm response, then the cart is edited, then pay → a new sale re-charges lines already paid. Fix: when a created sale exists and the cart changed, confirm or fetch the previous sale's status first. Also treat 409 `SALE_PAID` for our own sale id as paid.
- Abandoned sales stay with status `open` in the DB. Reports and voids must ignore `open` sales.
- After a lost `requestQr` followed by a cart edit, the own-sale 409 path matches on line keys only and removes the whole edited line after payment.
- Receiving into a product with `track_stock=False` still raises its stock quantity.

## Before the first update deploy
- A web build run as root by install.sh may leave root-owned `node_modules` in the source tree. A stale `web/dist` is never rebuilt automatically, so rebuild on the dev machine before every update.
- `pip install --upgrade pip` in install.sh is unpinned.

## Later / low priority
- `LineIn.name`, `unit`, `note` (custom sale lines) have no length bounds.
- Product search (`q`) does not escape LIKE wildcards and does not fold Vietnamese diacritics. Matters when a product list UI arrives (plan 6).
- `Settings.tz` is unused; `timeutil` hard-codes Asia/Ho_Chi_Minh.
- Alembic `env.py` has no offline mode and doesn't apply the SQLite pragmas.
