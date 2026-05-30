/**
 * Pesquisa de arrendamentos no Facebook Marketplace via Apify
 * (ator apify/facebook-marketplace-scraper).
 *
 * O FB geo-filtra por coordenadas + IP da região; por isso usamos lat/lng dos
 * Açores + proxy português. 3 centros cobrem as 9 ilhas. Devolve título, preço,
 * descrição (para o filtro de curta-duração), coordenadas e URL.
 */
const ACTOR = 'apify~facebook-marketplace-scraper'
const API = 'https://api.apify.com/v2'

// Centros de pesquisa (lat, lng, raio km) que cobrem o arquipélago.
const CENTROS = [
  { nome: 'São Miguel/Santa Maria', lat: 37.4, lng: -25.3, raio: 95 },
  { nome: 'Grupo Central', lat: 38.6, lng: -28.0, raio: 95 },
  { nome: 'Flores/Corvo', lat: 39.55, lng: -31.15, raio: 55 },
]

export type FbItem = {
  fbId: string
  titulo: string
  preco: string | null
  descricao: string
  ilha: string | null
  url: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Ilha aproximada a partir da longitude (os grupos estão bem separados). */
function ilhaFromLng(lng: number | null): string | null {
  if (lng == null) return null
  if (lng > -26.5) return 'São Miguel/Santa Maria'
  if (lng > -30) return 'Grupo Central'
  return 'Flores/Corvo'
}

/** Corre o ator do FB Marketplace para os Açores e devolve os anúncios. */
export async function fetchFbAzores(log: (m: string) => void): Promise<FbItem[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN em falta.')
  const limit = Number(process.env.FB_MAX_ITEMS || 150)

  const startUrls = CENTROS.map((c) => ({
    url: `https://www.facebook.com/marketplace/category/propertyrentals?latitude=${c.lat}&longitude=${c.lng}&radius=${c.raio}`,
  }))
  const input = {
    startUrls,
    resultsLimit: limit,
    includeListingDetails: true,
    proxyConfiguration: { useApifyProxy: true, apifyProxyCountry: 'PT' },
  }

  const start = await fetch(`${API}/acts/${ACTOR}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!start.ok) throw new Error(`FB Apify start ${start.status}: ${await start.text()}`)
  const run = (await start.json()).data as { id: string; status: string; defaultDatasetId: string }
  log(`FB Apify run ${run.id} iniciado (3 centros, limit ${limit})...`)

  let status = run.status
  let voltas = 0
  while (status === 'READY' || status === 'RUNNING') {
    await sleep(15000)
    const r = await fetch(`${API}/actor-runs/${run.id}?token=${token}`)
    status = ((await r.json()).data as { status: string }).status
    if (++voltas % 4 === 0) log(`  FB Apify ${status} (${voltas * 15}s)...`)
  }
  if (status !== 'SUCCEEDED') throw new Error(`FB Apify run terminou em ${status}`)

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
  log(`FB Apify devolveu ${items.length} anúncios.`)

  return items.map(mapItem).filter((x): x is FbItem => !!x)
}

function mapItem(it: Record<string, unknown>): FbItem | null {
  if (it.error) return null
  const url = String(it.itemUrl || it.facebookUrl || '')
  const fbId = String(it.id || url.match(/item\/(\d+)/)?.[1] || '')
  if (!fbId || !url) return null

  const desc = (it.description as { text?: string } | undefined)?.text || ''
  const titulo = String(it.listingTitle || desc.split('\n')[0] || '').slice(0, 200)
  const price = it.listingPrice as { formatted_amount?: string; amount?: string } | undefined
  const loc = it.location as { longitude?: number } | undefined

  return {
    fbId,
    titulo: titulo || '(sem título)',
    preco: price?.formatted_amount || price?.amount || null,
    descricao: desc,
    ilha: ilhaFromLng(loc?.longitude ?? null),
    url: url.split('?')[0],
  }
}
