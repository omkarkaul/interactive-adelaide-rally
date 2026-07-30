import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const OUT = 'docs/design/reference'
const PORT = Number(process.env.SHOTS_PORT ?? 4173)
const EXTERNAL = process.env.SHOTS_BASE
const mode = process.argv[2] ?? 'current'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 }
]

const appStates = [
  { name: 'day-view', path: '/?year=2026&day=1' },
  { name: 'day-view-scrubbed', path: '/?year=2026&day=1&t=09:40' },
  { name: 'day-view-three-states', path: '/?year=2026&day=1&t=13:00' },
  { name: 'detail', path: '/?year=2026&day=1&stage=SS4' },
  { name: 'detail-scrubbed', path: '/?year=2026&day=1&stage=SS4&t=09:40' }
]

const mockups = ['day-view', 'elevation-profile', 'stage-detail', 'stage-detail-mobile']

function build() {
  const r = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error('vite build failed')
}

async function waitForPort(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`preview server did not start on ${url}`)
}

async function serve() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  const base = `http://localhost:${PORT}`
  await waitForPort(base)
  return { base, stop: () => proc.kill() }
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  const canvas = page.locator('.maplibregl-canvas')
  if (await canvas.count()) {
    await canvas.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2500)
  }
  await page.waitForTimeout(400)
}

async function main() {
  await mkdir(OUT, { recursive: true })

  let server = null
  let base = EXTERNAL

  if (mode !== 'target' && !EXTERNAL) {
    build()
    server = await serve()
    base = server.base
  }

  const targets =
    mode === 'target'
      ? mockups.map((m) => ({
          name: m,
          url: pathToFileURL(resolve(`docs/design/mockups/${m}.html`)).href
        }))
      : appStates.map((s) => ({ name: s.name, url: base + s.path }))

  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  })

  try {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.name === 'mobile',
        hasTouch: vp.name === 'mobile'
      })
      const page = await context.newPage()

      for (const target of targets) {
        await page.goto(target.url, { waitUntil: 'domcontentloaded' })
        await settle(page)
        const file = `${OUT}/${mode}-${vp.name}-${target.name}.png`
        await page.screenshot({ path: file })
        console.log(file)
      }

      await context.close()
    }
  } finally {
    await browser.close()
    server?.stop()
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
