import { query } from './db'
import {
  jaccard,
  levenshteinSim,
  nameTokens,
  normalizeAddress,
  normalizeRral,
} from './normalize'

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

// Limiares conservadores para reduzir falsos positivos (marcar registado a mais).
const NOME_THRESHOLD = 0.62
const MORADA_THRESHOLD = 0.7

export type Alvo = {
  nome: string
  morada: string | null
  rralDetetado: string | null
}

/**
 * Classifica um anúncio do Booking contra o índice oficial (registo_al).
 * Ordem: nº RRAL → nome (com reforço de morada) → senão, suspeito.
 */
export async function classificar(alvo: Alvo): Promise<Classificacao> {
  // 1) Match exato por número de registo (quando o índice já tem RRAL).
  if (alvo.rralDetetado) {
    const rral = normalizeRral(alvo.rralDetetado)
    const [hit] = await query<RegistoRow>(
      `SELECT id, rral, nome, nome_norm, morada, morada_norm, ilha
         FROM registo_al
        WHERE rral IS NOT NULL
          AND replace(replace(replace(rral, ' ', ''), '-', ''), 'RRAL', '') = $1
        LIMIT 1`,
      [rral],
    )
    if (hit) return { registado: true, via: 'rral', match: hit, score: 1 }
    // Não confirmado por RRAL — continua para o match por nome (cobertura de
    // RRAL no índice é incremental, por isso não declaramos suspeito já aqui).
  }

  // 2) Match aproximado por nome (+ confirmação por morada).
  const candidatos = await query<RegistoRow>(
    `SELECT id, rral, nome, nome_norm, morada, morada_norm, ilha FROM registo_al`,
  )
  const alvoTokens = nameTokens(alvo.nome)
  const alvoMorada = alvo.morada ? normalizeAddress(alvo.morada) : ''

  let melhor: { row: RegistoRow; score: number; via: 'nome' | 'morada' } | null = null

  for (const row of candidatos) {
    const nomeScore = Math.max(
      jaccard(alvoTokens, row.nome_norm.split(' ')),
      levenshteinSim(alvoTokens.join(' '), row.nome_norm),
    )
    if (nomeScore >= NOME_THRESHOLD) {
      if (!melhor || nomeScore > melhor.score) {
        melhor = { row, score: nomeScore, via: 'nome' }
      }
    }
    // Reforço por morada (quando ambos têm morada).
    if (alvoMorada && row.morada_norm) {
      const moradaScore = levenshteinSim(alvoMorada, row.morada_norm)
      if (moradaScore >= MORADA_THRESHOLD && (!melhor || moradaScore > melhor.score)) {
        melhor = { row, score: moradaScore, via: 'morada' }
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
