import type { BrowserContext } from 'playwright'
import { isBlocked, BlockedError, sleep } from '../browser'
import type { Ilha } from '../ilhas'

export type ListingRef = { bookingId: string; url: string; ilha: Ilha }

const PAGE_SIZE = 25
const MAX_PAGES = Number(process.env.MAX_SEARCH_PAGES || 8) // limite de segurança por ilha

/** Deriva um id estável do anúncio a partir do URL do hotel. */
export function bookingIdFromUrl(url: string): string | null {
  const m = url.match(/\/hotel\/[a-z]{2}\/([^.?/]+)\.[a-z-]+\.html/i)
  return m ? m[1].toLowerCase() : null
}

function searchUrl(ilha: Ilha, offset: number): string {
  const ss = encodeURIComponent(`${ilha}, Açores, Portugal`)
  // nflt=ht_id%3D220 restringe a "Apartamentos"; deixamos amplo para apanhar AL/guesthouses.
  return (
    `https://www.booking.com/searchresults.pt-pt.html?ss=${ss}` +
    `&lang=pt-pt&offset=${offset}`
  )
}

/** Recolhe as referências de anúncios para uma ilha, paginando. */
export async function searchIlha(
  ctx: BrowserContext,
  ilha: Ilha,
  delayMs: number,
): Promise<ListingRef[]> {
  const page = await ctx.newPage()
  const seen = new Map<string, ListingRef>()
  try {
    for (let p = 0; p < MAX_PAGES; p++) {
      await page.goto(searchUrl(ilha, p * PAGE_SIZE), {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })
      if (await isBlocked(page)) throw new BlockedError()

      // Aceita cookies na primeira página (se aparecer o banner).
      await page
        .locator('#onetrust-accept-btn-handler')
        .click({ timeout: 3000 })
        .catch(() => {})

      await page
        .locator('[data-testid="property-card"]')
        .first()
        .waitFor({ timeout: 15000 })
        .catch(() => {})

      const hrefs = await page.$$eval('a[href*="/hotel/"]', (as) =>
        (as as HTMLAnchorElement[]).map((a) => a.href),
      )
      let novos = 0
      for (const href of hrefs) {
        const url = href.split('?')[0]
        const id = bookingIdFromUrl(url)
        if (id && !seen.has(id)) {
          seen.set(id, { bookingId: id, url, ilha })
          novos++
        }
      }
      // Sem novos resultados → fim da paginação.
      if (novos === 0) break
      await sleep(delayMs)
    }
  } finally {
    await page.close()
  }
  return [...seen.values()]
}
