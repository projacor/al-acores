import { query } from './db'
import { levenshteinSim, nameTokens, normalizeRral } from './normalize'

export type RegistoRow = {
  id: number
  rral: string | null
  nome: string
  nome_norm: string
  morada: string | null
  morada_norm: string | null
  ilha: string | null
}

export type Classificacao =
  | { registado: true; via: 'rral' | 'nome' | 'morada'; match: RegistoRow; score: number }
  | { registado: false; motivo: Motivo; melhor?: { nome: string; score: number } }

export type Motivo = 'sem_rral' | 'rral_nao_encontrado' | 'nome_morada_nao_encontrados'

// Fração mínima de overlap (tokens partilhados / menor conjunto) para casar nome.
const NOME_OVERLAP = 0.6

/** Código postal (9XXX-XXX) normalizado sem hífen, ou '' se não houver. */
function postal(s: string | null): string {
  const m = (s || '').match(/9\d{3}-?\d{3}/)
  return m ? m[0].replace('-', '') : ''
}

/** Tokens distintivos da rua (sem números nem palavras curtas). */
function ruaTokens(s: string | null): Set<string> {
  return new Set(nameTokens(s || '').filter((t) => t.length > 2 && !/^\d+$/.test(t)))
}

export type Alvo = {
  nome: string
  morada: string | null
  rralDetetado: string | null
}

// O registo é carregado uma vez por processo (o worker corre um scan e sai).
let cacheCandidatos: RegistoRow[] | null = null
let cacheRral: Map<string, RegistoRow> | null = null

async function getCandidatos(): Promise<RegistoRow[]> {
  if (!cacheCandidatos) {
    cacheCandidatos = await query<RegistoRow>(
      `SELECT id, rral, nome, nome_norm, morada, morada_norm, ilha FROM registo_al`,
    )
    cacheRral = new Map()
    for (const r of cacheCandidatos) {
      if (r.rral) {
        const k = normalizeRral(r.rral)
        if (k && !cacheRral.has(k)) cacheRral.set(k, r)
      }
    }
  }
  return cacheCandidatos
}

/**
 * Classifica um anúncio do Booking contra o índice oficial (registo_al).
 * Ordem: nº RRAL → nome (com reforço de morada) → senão, suspeito.
 */
export async function classificar(alvo: Alvo): Promise<Classificacao> {
  const candidatos = await getCandidatos()

  // 1) Match exato por número de registo (sinal mais forte).
  if (alvo.rralDetetado) {
    const rral = normalizeRral(alvo.rralDetetado)
    const hit = rral ? cacheRral?.get(rral) : undefined
    if (hit) return { registado: true, via: 'rral', match: hit, score: 1 }
    // Não confirmado por RRAL — continua para o match por nome.
  }

  // 2) Match por nome via tokens distintivos partilhados.
  //    O registo tem o nome do dono à frente ("Dono – Nome Comercial") e o
  //    Booking acrescenta sufixos de marketing ("- Ocean View"). Por isso
  //    contamos quantos tokens distintivos coincidem, em vez de Jaccard.
  const alvoTokens = nameTokens(alvo.nome)
  const alvoSet = new Set(alvoTokens)
  // Para morada: código postal + tokens de rua (desambigua nomes curtos).
  const alvoPostal = postal(alvo.morada)
  const alvoRua = ruaTokens(alvo.morada)

  let melhor: { row: RegistoRow; score: number; via: 'nome' | 'morada' } | null = null

  for (const row of candidatos) {
    // 2a) Match por morada: mesmo código postal + ≥2 tokens de rua → forte.
    if (alvoPostal && row.morada && postal(row.morada) === alvoPostal) {
      const regRua = ruaTokens(row.morada)
      let s = 0
      for (const t of alvoRua) if (regRua.has(t)) s++
      if (s >= 2) {
        const score = 10 + s // morada bate mais que nome
        if (!melhor || score > melhor.score) melhor = { row, score, via: 'morada' }
        continue
      }
    }
    // 2b) Match por nome: tokens distintivos partilhados (≥2) ou quase idêntico.
    const regSet = new Set(row.nome_norm.split(' ').filter(Boolean))
    if (regSet.size) {
      let shared = 0
      for (const t of alvoSet) if (regSet.has(t)) shared++
      const overlap = shared / Math.min(alvoSet.size, regSet.size)
      const exato = levenshteinSim(alvoTokens.join(' '), row.nome_norm) >= 0.9
      if ((shared >= 2 && overlap >= NOME_OVERLAP) || exato) {
        const score = shared + overlap
        if (!melhor || score > melhor.score) melhor = { row, score, via: 'nome' }
      }
    }
  }

  if (melhor) {
    return { registado: true, via: melhor.via, match: melhor.row, score: melhor.score }
  }

  return {
    registado: false,
    motivo: alvo.rralDetetado ? 'rral_nao_encontrado' : 'nome_morada_nao_encontrados',
  }
}
