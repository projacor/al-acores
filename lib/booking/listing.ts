import type { BrowserContext } from 'playwright'
import { isBlocked, BlockedError } from '../browser'
import { extractRral } from '../normalize'
import type { ListingRef } from './search'

export type ListingData = {
  bookingId: string
  url: string
  ilha: string
  nome: string
  morada: string | null
  rralDetetado: string | null
}

/** Abre a página de um anúncio e extrai nome, morada e nº RRAL (se visível). */
export async function scrapeListing(
  ctx: BrowserContext,
  ref: ListingRef,
): Promise<ListingData> {
  const page = await ctx.newPage()
  try {
    await page.goto(ref.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    if (await isBlocked(page)) throw new BlockedError()

    const nome =
      (await text(page, 'h2[data-testid="title"]')) ||
      (await text(page, '#hp_hotel_name')) ||
      (await page.title()).replace(/\s*[-–|].*$/, '').trim() ||
      ref.bookingId

    const morada =
      (await text(page, '[data-testid="PropertyHeaderAddressDesktop-wrapper"]')) ||
      (await text(page, '[data-testid="address"]')) ||
      (await text(page, '.hp_address_subtitle')) ||
      null

    // Texto completo da página para procurar o número de registo.
    const body = await page
      .locator('body')
      .innerText()
      .catch(() => '')
    const rralDetetado = extractRral(body)

    return {
      bookingId: ref.bookingId,
      url: ref.url,
      ilha: ref.ilha,
      nome: nome.trim(),
      morada: morada ? morada.replace(/\s+/g, ' ').trim() : null,
      rralDetetado,
    }
  } finally {
    await page.close()
  }
}

async function text(
  page: import('playwright').Page,
  selector: string,
): Promise<string | null> {
  try {
    const el = page.locator(selector).first()
    if ((await el.count()) === 0) return null
    const t = await el.innerText({ timeout: 2000 })
    return t?.trim() || null
  } catch {
    return null
  }
}
