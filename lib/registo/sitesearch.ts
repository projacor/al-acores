/**
 * Fallback de verificação: pesquisa o nome do alojamento na própria pesquisa do
 * portal do governo (turismo.azores.gov.pt/?s=...). Equivale ao
 * "site:turismo.azores.gov.pt <nome>" do Google, mas direto e gratuito.
 *
 * Usado quando o cruzamento pelo índice (RRAL/nome/morada) não encontra:
 * se o portal devolver uma página /pin/ compatível, o AL ESTÁ registado.
 */
import { nameTokens } from '../normalize'

const BASE = 'https://turismo.azores.gov.pt'
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
}

/** Núcleo do nome (antes de sufixos de marketing após " - "). */
function nucleo(nome: string): string {
  return nome.split(/\s[-–—]\s/)[0].trim() || nome
}

/**
 * Verifica se o nome existe no portal. Devolve o slug encontrado, ou null.
 * Confirma que algum resultado /pin/ partilha os tokens distintivos do nome
 * (evita aceitar correspondências fracas da pesquisa difusa).
 */
export async function existeNoPortal(nome: string): Promise<string | null> {
  const core = nucleo(nome)
  const tokens = nameTokens(core).filter((t) => t.length > 2)
  if (tokens.length === 0) return null

  const url = `${BASE}/?s=${encodeURIComponent(core)}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`pesquisa do portal: HTTP ${res.status}`)
  const html = await res.text()

  const slugs = [...new Set([...html.matchAll(/\/pin\/([a-z0-9-]+)\//g)].map((m) => m[1]))]
  for (const slug of slugs) {
    const st = new Set(slug.split('-'))
    const shared = tokens.filter((t) => st.has(t)).length
    // Todos os tokens do núcleo presentes, ou ≥2 (nomes longos).
    if (shared === tokens.length || shared >= 2) return slug
  }
  return null
}
