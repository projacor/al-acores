/**
 * Índice do registo regional de AL dos Açores (turismo.azores.gov.pt).
 *
 * Fonte primária: a página do mapa /al-map/ embebe `var pins = [...]` com TODOS
 * os AL (título, ilha, alias) numa só request. O nº RRAL e a morada vêm das
 * páginas de detalhe /pin/<alias>/, que são HTML estático (basta fetch + regex).
 */
import { query } from '../db'
import { normalizeAddress, normalizeName, extractRral } from '../normalize'

const BASE = 'https://turismo.azores.gov.pt'

// Headers de browser realista — o portal devolve 403 a User-Agents não-browser.
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
}

const SLUG_ILHA: Record<string, string> = {
  'santa-maria': 'Santa Maria',
  'sao-miguel': 'São Miguel',
  terceira: 'Terceira',
  graciosa: 'Graciosa',
  'sao-jorge': 'São Jorge',
  pico: 'Pico',
  faial: 'Faial',
  flores: 'Flores',
  corvo: 'Corvo',
}

type Pin = { title: string; ilha: string | null; alias: string }

function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#8220;|&#8221;|&#8217;|&#8216;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/** Lê o array `pins` do mapa → lista completa de AL (sem RRAL/morada). */
export async function fetchPins(): Promise<Pin[]> {
  const res = await fetch(`${BASE}/al-map/`, { headers: HEADERS })
  if (!res.ok) throw new Error(`al-map respondeu ${res.status}`)
  const html = await res.text()
  const m = html.match(/var pins = (\[[\s\S]*?\]);/)
  if (!m) throw new Error('Não foi possível localizar o array `pins` em /al-map/.')
  const raw = JSON.parse(m[1]) as Array<{
    title: string
    azores?: string[]
    alias: string
  }>
  return raw
    .filter((p) => p.alias)
    .map((p) => ({
      title: decodeEntities(p.title),
      ilha: p.azores?.[0] ? SLUG_ILHA[p.azores[0]] ?? null : null,
      alias: p.alias,
    }))
}

type Detalhe = { rral: string | null; morada: string | null }

/** Lê RRAL e morada de uma página de detalhe /pin/<alias>/. */
export async function fetchDetalhe(alias: string): Promise<Detalhe> {
  const res = await fetch(`${BASE}/pin/${alias}/`, { headers: HEADERS })
  if (!res.ok) return { rral: null, morada: null }
  const html = await res.text()

  const blocos = [...html.matchAll(/<div class="dados-text"><b>(.*?)<\/b>([\s\S]*?)<\/div>/g)]
  let rral: string | null = null
  let morada: string | null = null
  for (const b of blocos) {
    const label = decodeEntities(b[1].replace(/<[^>]+>/g, ''))
    const value = decodeEntities(
      b[2].replace(/<\/?br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''),
    )
    if (/registo/i.test(label)) rral = extractRral(value)
    else if (/localiza/i.test(label)) {
      // Linhas: rua / código-postal-localidade / ilha → morada = tudo menos a ilha final.
      const linhas = value.split('\n').map((l) => l.trim()).filter(Boolean)
      morada = linhas.slice(0, Math.max(1, linhas.length - 1)).join(', ')
    }
  }
  return { rral, morada }
}

/**
 * Atualiza a tabela registo_al a partir do portal dos Açores.
 * - Sempre faz upsert da lista-mestra (nome + ilha).
 * - Enriquece com RRAL/morada as linhas em falta, com rate-limit e limite opcional.
 */
export async function refreshAzores(opts?: {
  enrichLimit?: number
  delayMs?: number
  log?: (m: string) => void
}): Promise<{ total: number; enriquecidos: number }> {
  const log = opts?.log ?? (() => {})
  const delayMs = opts?.delayMs ?? 800
  const enrichLimit = opts?.enrichLimit ?? Number(process.env.REGISTO_ENRICH_LIMIT || 0)

  const pins = await fetchPins()
  log(`al-map: ${pins.length} AL na lista-mestra.`)

  // Upsert da lista-mestra (por slug único).
  for (const p of pins) {
    await query(
      `INSERT INTO registo_al (slug, nome, nome_norm, ilha, fonte)
       VALUES ($1, $2, $3, $4, 'azores')
       ON CONFLICT (slug) DO UPDATE SET
         nome = EXCLUDED.nome,
         nome_norm = EXCLUDED.nome_norm,
         ilha = EXCLUDED.ilha,
         atualizado_em = now()`,
      [p.alias, p.title, normalizeName(p.title), p.ilha],
    )
  }

  // Enriquecer linhas ainda sem RRAL (resumível entre execuções).
  const porEnriquecer = await query<{ slug: string }>(
    `SELECT slug FROM registo_al
      WHERE fonte = 'azores' AND rral IS NULL
      ${enrichLimit > 0 ? 'LIMIT ' + enrichLimit : ''}`,
  )
  log(`A enriquecer ${porEnriquecer.length} detalhes...`)

  let enriquecidos = 0
  for (const { slug } of porEnriquecer) {
    try {
      const d = await fetchDetalhe(slug)
      if (d.rral || d.morada) {
        await query(
          `UPDATE registo_al
              SET rral = $2, morada = $3, morada_norm = $4, atualizado_em = now()
            WHERE slug = $1`,
          [slug, d.rral, d.morada, d.morada ? normalizeAddress(d.morada) : null],
        )
        enriquecidos++
      }
    } catch (e) {
      log(`detalhe ${slug} falhou: ${(e as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }

  return { total: pins.length, enriquecidos }
}
