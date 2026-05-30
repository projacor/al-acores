/**
 * Índice do registo regional de AL dos Açores (turismo.azores.gov.pt).
 *
 * Fonte: o SITEMAP (`/sitemap.xml` → `/sitemap-pin-N.xml`) lista TODAS as páginas
 * `/pin/<slug>/` de AL (muito mais completo que o /al-map/, que só tinha os
 * geocodificados). Cada `/pin/` é HTML estático: extraímos nome (H1), nº RRAL,
 * morada e deduzimos a ilha pelo código postal.
 */
import { query } from '../db'
import { normalizeAddress, normalizeName, commercialName, extractRral } from '../normalize'
import { ilhaFromMorada } from '../ilhas'

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

function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/** Lê todos os slugs de AL a partir do sitemap (lista completa). */
export async function fetchSlugs(): Promise<string[]> {
  const idx = await (await fetch(`${BASE}/sitemap.xml`, { headers: HEADERS })).text()
  const pinMaps = [...idx.matchAll(/<loc>([^<]*sitemap-pin[^<]*)<\/loc>/g)].map((m) => m[1])
  if (pinMaps.length === 0) throw new Error('Sitemap sem sub-sitemaps de pin.')

  const slugs = new Set<string>()
  for (const pm of pinMaps) {
    const xml = await (await fetch(pm, { headers: HEADERS })).text()
    for (const m of xml.matchAll(/<loc>https?:\/\/[^<]*\/pin\/([^<\/]+)\/?<\/loc>/g)) {
      slugs.add(m[1].replace(/\/$/, ''))
    }
  }
  return [...slugs]
}

type Detalhe = { nome: string | null; rral: string | null; morada: string | null }

/** Lê nome (H1), RRAL e morada de uma página de detalhe /pin/<slug>/. */
export async function fetchDetalhe(slug: string): Promise<Detalhe> {
  const res = await fetch(`${BASE}/pin/${slug}/`, { headers: HEADERS })
  if (!res.ok) return { nome: null, rral: null, morada: null }
  const html = await res.text()

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const nome = h1 ? decodeEntities(h1[1].replace(/<[^>]+>/g, '')) || null : null

  const blocos = [...html.matchAll(/<div class="dados-text"><b>(.*?)<\/b>([\s\S]*?)<\/div>/g)]
  let rral: string | null = null
  let morada: string | null = null
  for (const b of blocos) {
    const label = decodeEntities(b[1].replace(/<[^>]+>/g, ''))
    const value = decodeEntities(b[2].replace(/<\/?br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''))
    if (/registo/i.test(label)) rral = extractRral(value)
    else if (/localiza/i.test(label)) {
      const linhas = value.split('\n').map((l) => l.trim()).filter(Boolean)
      morada = linhas.slice(0, Math.max(1, linhas.length - 1)).join(', ')
    }
  }
  return { nome, rral, morada }
}

function nomeFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Corre `fn` sobre `items` com concorrência limitada. */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        try {
          await fn(items[idx])
        } catch {
          /* ignora falhas individuais */
        }
      }
    }),
  )
}

/**
 * Atualiza registo_al a partir do sitemap dos Açores.
 * - Upsert da lista-mestra (slug + nome provisório derivado do slug).
 * - Enriquece com nome (H1), RRAL, morada e ilha as linhas em falta (concorrente).
 */
export async function refreshAzores(opts?: {
  enrichLimit?: number
  concurrency?: number
  log?: (m: string) => void
}): Promise<{ total: number; enriquecidos: number }> {
  const log = opts?.log ?? (() => {})
  const concurrency = opts?.concurrency ?? Number(process.env.REGISTO_CONCURRENCY || 6)
  const enrichLimit = opts?.enrichLimit ?? Number(process.env.REGISTO_ENRICH_LIMIT || 0)

  const slugs = await fetchSlugs()
  log(`sitemap: ${slugs.length} AL na lista-mestra.`)

  // Upsert da lista-mestra em lotes (slug + nome provisório a partir do slug).
  const CHUNK = 500
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const lote = slugs.slice(i, i + CHUNK)
    const valores: string[] = []
    const params: unknown[] = []
    lote.forEach((slug, j) => {
      const b = j * 3
      const nome = nomeFromSlug(slug)
      valores.push(`($${b + 1}, $${b + 2}, $${b + 3}, 'azores')`)
      params.push(slug, nome, normalizeName(commercialName(nome)))
    })
    await query(
      `INSERT INTO registo_al (slug, nome, nome_norm, fonte)
       VALUES ${valores.join(', ')}
       ON CONFLICT (slug) DO NOTHING`,
      params,
    )
  }
  log(`Lista-mestra carregada (${slugs.length}).`)

  // Enriquecer linhas ainda sem RRAL (resumível entre execuções), em paralelo.
  const porEnriquecer = await query<{ slug: string }>(
    `SELECT slug FROM registo_al
      WHERE fonte = 'azores' AND rral IS NULL
      ${enrichLimit > 0 ? 'LIMIT ' + enrichLimit : ''}`,
  )
  log(`A enriquecer ${porEnriquecer.length} detalhes (concorrência ${concurrency})...`)

  let enriquecidos = 0
  let feitos = 0
  await pool(porEnriquecer, concurrency, async ({ slug }) => {
    const d = await fetchDetalhe(slug)
    const nome = d.nome || nomeFromSlug(slug)
    const ilha = ilhaFromMorada(d.morada)
    await query(
      `UPDATE registo_al
          SET nome = $2, nome_norm = $3, rral = $4, morada = $5, morada_norm = $6,
              ilha = COALESCE($7, ilha), atualizado_em = now()
        WHERE slug = $1`,
      [
        slug,
        nome,
        normalizeName(commercialName(nome)),
        d.rral,
        d.morada,
        d.morada ? normalizeAddress(d.morada) : null,
        ilha,
      ],
    )
    if (d.rral) enriquecidos++
    if (++feitos % 500 === 0) log(`  enriquecidos ${feitos}/${porEnriquecer.length}`)
  })

  return { total: slugs.length, enriquecidos }
}
