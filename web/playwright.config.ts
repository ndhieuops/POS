import { defineConfig } from "@playwright/test"
import { mkdtempSync } from "node:fs"
import { createServer } from "node:net"
import { networkInterfaces, tmpdir } from "node:os"
import { join } from "node:path"

// Config is re-evaluated in workers; persist choices in env so they agree.
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once("error", reject)
    s.listen(0, process.env.POS_E2E_HOST, () => {
      const p = (s.address() as { port: number }).port
      s.close(() => resolve(p))
    })
  })
}

// Prefer a non-loopback IPv4 so the page is not a secure context, like a floor
// screen opening http://<LAN IP>:8080 (crypto.randomUUID is undefined there).
function lanIp(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address
    }
  }
  return "127.0.0.1"
}

if (!process.env.POS_E2E_HOST) process.env.POS_E2E_HOST = lanIp()
if (!process.env.POS_E2E_PORT) process.env.POS_E2E_PORT = String(await freePort())
if (!process.env.POS_E2E_DIR) process.env.POS_E2E_DIR = mkdtempSync(join(tmpdir(), "pos-e2e-"))
const host = process.env.POS_E2E_HOST
const port = process.env.POS_E2E_PORT
const dir = process.env.POS_E2E_DIR

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://${host}:${port}`, locale: "vi-VN" },
  webServer: {
    command: `npx vite build && ../server/.venv/bin/uvicorn pos.main:create_app --factory --app-dir ../server --host ${host} --port ${port}`,
    url: `http://${host}:${port}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      POS_DB_PATH: join(dir, "pos.db"),
      POS_BACKUP_DIR: join(dir, "backups"),
      POS_WEB_DIST: join(process.cwd(), "dist"),
    },
  },
})
