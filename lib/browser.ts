import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Abre um browser headless com fingerprint realista. */
export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  })
}

export async function newContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: 'pt-PT',
    timezoneId: 'Atlantic/Azores',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' },
  })
  // Esconde o sinal navigator.webdriver.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  return ctx
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Deteta páginas de bloqueio anti-bot (Cloudflare / captcha do Booking). */
export async function isBlocked(page: Page): Promise<boolean> {
  const title = (await page.title()).toLowerCase()
  if (/just a moment|access denied|attention required|robot|captcha/.test(title)) {
    return true
  }
  const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
  return /verifique que (é|e) humano|are you a robot|unusual traffic|px-captcha/.test(body)
}

export class BlockedError extends Error {
  constructor(msg = 'Pedido bloqueado pela origem (anti-bot).') {
    super(msg)
    this.name = 'BlockedError'
  }
}
