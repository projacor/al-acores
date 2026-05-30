/**
 * Pesquisa de alojamentos no Booking via Apify (ator voyager/booking-scraper).
 * O Apify trata da paginação/anti-bot e devolve TODAS as propriedades de uma
 * região (não os ~75 do scroll do site), com nome, morada, RRAL (licenseInfo)
 * e tipo. Substitui o scraping próprio com Playwright.
 */
import { ilhaFromMorada } from '../ilhas'

const ACTOR = 'voyager~booking-scraper'
const API = 'https://api.apify.com/v2'

export type BookingItem = {
  bookingId: string
  nome: string
  morada: string | null
  ilha: string | null
  rralDetetado: string | null
  companyName: string | null
  tipo: string | null
  url: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Corre o ator do Apify para a região e devolve as propriedades normalizadas. */
export async function fetchBookingApify(
  log: (m: string) => void,
): Promise<BookingItem[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN em falta.')

  const maxItems = Number(process.env.APIFY_MAX_ITEMS || 0)
  const input: Record<string, unknown> = {
    search: process.env.APIFY_SEARCH || 'Açores',
    currency: 'EUR',
    language: 'en-gb',
    sortBy: 'bayesian_review_score',
    proxyConfiguration: { useApifyProxy: true },
  }
  if (maxItems > 0) input.maxItems = maxItems

  // 1) Arrancar a corrida (assíncrona — a região pode demorar > 5 min).
  const start = await fetch(`${API}/acts/${ACTOR}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!start.ok) throw new Error(`Apify start ${start.status}: ${await start.text()}`)
  const run = (await start.json()).data as { id: string; status: string; defaultDatasetId: string }
  log(`Apify run ${run.id} iniciado (search="${input.search}", maxItems=${maxItems || '∞'})...`)

  // 2) Esperar a conclusão.
  let status = run.status
  let voltas = 0
  while (status === 'READY' || status === 'RUNNING') {
    await sleep(15000)
    const r = await fetch(`${API}/actor-runs/${run.id}?token=${token}`)
    status = ((await r.json()).data as { status: string }).status
    if (++voltas % 4 === 0) log(`  Apify ${status} (${voltas * 15}s)...`)
  }
  if (status !== 'SUCCEEDED') throw new Error(`Apify run terminou em ${status}`)

  // 3) Ler o dataset (paginado).
  const items: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(
      `${API}/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=1000&offset=${offset}&token=${token}`,
    )
    const batch = (await r.json()) as Record<string, unknown>[]
    if (!Array.isArray(batch) || batch.length === 0) break
    items.push(...batch)
    if (batch.length < 1000) break
  }
  log(`Apify devolveu ${items.length} propriedades.`)

  return items.map(mapItem).filter((x): x is BookingItem => !!x && !!x.bookingId)
}

function mapItem(it: Record<string, unknown>): BookingItem | null {
  const url = String(it.url || '').split('?')[0]
  const hotelId = it.hotelId ? String(it.hotelId) : ''
  const bookingId = (hotelId || url.match(/\/hotel\/[a-z]{2}\/([^.?/]+)\./i)?.[1] || '').toLowerCase()
  if (!bookingId) return null

  const address = it.address as { full?: string } | undefined
  const morada = address?.full || null

  const license = it.licenseInfo as { numbers?: string[] } | undefined
  const rralDetetado = license?.numbers?.length ? String(license.numbers[0]) : null

  const trader = it.traderInfo as { companyName?: string } | undefined

  return {
    bookingId,
    nome: String(it.name || bookingId),
    morada,
    ilha: ilhaFromMorada(morada),
    rralDetetado,
    companyName: trader?.companyName || null,
    tipo: it.type ? String(it.type) : null,
    url: String(it.url || url),
  }
}
