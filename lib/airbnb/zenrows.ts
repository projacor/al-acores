/**
 * Pesquisa de Airbnb nos Açores via ZenRows (API de scraping com anti-bot).
 *
 * O Apify não enumera o Airbnb (todos os atores testados falharam). O ZenRows
 * busca a página de pesquisa do Airbnb (JS render + proxy PT) e nós extraímos as
 * listagens do JSON `data-deferred-state` embebido (objetos DemandStayListing
 * com id, nome e coordenadas). Os nomes são comerciais, sem nº de registo.
 */
import { Buffer } from 'node:buffer'

export type AirbnbItem = {
  airbnbId: string
  nome: string
  ilha: string | null
  lat: number | null
  lng: number | null
  url: string
}

const ZR = 'https://api.zenrows.com/v1/'

/** Ilha aproximada a partir das coordenadas (grupos bem separados por longitude). */
function ilhaFromCoord(lat: number | null, lng: number | null): string | null {
  if (lng == null) return null
  if (lng > -26.5) return lat != null && lat < 37.2 ? 'Santa Maria' : 'São Miguel'
  if (lng > -27.6) return 'Terceira'
  if (lng > -28.2) return lat != null && lat > 38.9 ? 'Graciosa' : 'São Jorge'
  if (lng > -29.5) return lat != null && lat > 38.52 ? 'Faial' : 'Pico'
  return lat != null && lat < 39.55 ? 'Flores' : 'Corvo'
}

/** Faz um pedido ZenRows e devolve o HTML da página do Airbnb. */
async function zenrowsGet(targetUrl: string, apikey: string): Promise<string> {
  const params = new URLSearchParams({
    apikey,
    url: targetUrl,
    js_render: 'true',
    premium_proxy: 'true',
    proxy_country: 'pt',
  })
  const res = await fetch(`${ZR}?${params}`, { signal: AbortSignal.timeout(180000) })
  if (!res.ok) throw new Error(`ZenRows HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.text()
}

type Parsed = { itens: AirbnbItem[]; cursores: string[] }

/** Extrai as listagens (e os cursores de paginação) do HTML do Airbnb. */
function parseAirbnb(html: string): Parsed {
  const m = html.match(/<script id="data-deferred-state[^"]*"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return { itens: [], cursores: [] }
  let data: unknown
  try {
    data = JSON.parse(m[1])
  } catch {
    return { itens: [], cursores: [] }
  }

  const itens: AirbnbItem[] = []
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) {
      o.forEach(walk)
    } else if (o && typeof o === 'object') {
      const rec = o as Record<string, unknown>
      if (rec.__typename === 'DemandStayListing') {
        let id = String(rec.id || '')
        try {
          id = Buffer.from(id, 'base64').toString('utf8').split(':').pop() || id
        } catch {
          /* mantém o id original */
        }
        const desc = rec.description as { name?: { localizedStringWithTranslationPreference?: string } } | undefined
        const nome = desc?.name?.localizedStringWithTranslationPreference || ''
        const coord = (rec.location as { coordinate?: { latitude?: number; longitude?: number } } | undefined)
          ?.coordinate
        const lat = coord?.latitude ?? null
        const lng = coord?.longitude ?? null
        if (id && nome) {
          itens.push({
            airbnbId: id,
            nome,
            ilha: ilhaFromCoord(lat, lng),
            lat,
            lng,
            url: `https://www.airbnb.com/rooms/${id}`,
          })
        }
      }
      for (const v of Object.values(rec)) walk(v)
    }
  }
  walk(data)

  const cm = m[1].match(/"pageCursors":\[([^\]]*)\]/)
  const cursores = cm ? (cm[1].match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1)) : []
  return { itens, cursores }
}

/**
 * Pesquisa Airbnb nos Açores. Por cada localidade, percorre até `maxPages`
 * páginas. Devolve listagens únicas por airbnbId. Filtra para coordenadas
 * dos Açores (lng entre -32 e -24).
 */
export async function fetchAirbnbAzores(log: (m: string) => void): Promise<AirbnbItem[]> {
  const apikey = process.env.ZENROWS_API_KEY
  if (!apikey) throw new Error('ZENROWS_API_KEY em falta.')

  const queries = (process.env.AIRBNB_QUERIES || 'Azores--Portugal')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  const maxPages = Number(process.env.AIRBNB_MAX_PAGES || 3)

  const porId = new Map<string, AirbnbItem>()
  for (const q of queries) {
    const base = `https://www.airbnb.com/s/${encodeURIComponent(q)}/homes`
    let cursores: string[] = []
    for (let p = 0; p < maxPages; p++) {
      const url = p === 0 ? base : `${base}?cursor=${encodeURIComponent(cursores[p] || '')}`
      if (p > 0 && !cursores[p]) break
      try {
        const html = await zenrowsGet(url, apikey)
        const parsed = parseAirbnb(html)
        if (p === 0) cursores = parsed.cursores
        let novos = 0
        for (const it of parsed.itens) {
          if (it.lng != null && it.lng > -24) continue // fora dos Açores
          if (!porId.has(it.airbnbId)) {
            porId.set(it.airbnbId, it)
            novos++
          }
        }
        log(`  Airbnb "${q}" pág ${p + 1}: ${parsed.itens.length} listagens (+${novos} novas)`)
        if (parsed.itens.length === 0) break
      } catch (e) {
        log(`  Airbnb "${q}" pág ${p + 1} falhou: ${(e as Error).message}`)
        break
      }
    }
  }
  log(`Airbnb: ${porId.size} listagens únicas nos Açores.`)
  return [...porId.values()]
}
