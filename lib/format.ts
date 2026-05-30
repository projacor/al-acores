import { normalizeRral } from './normalize'

/** Remove coordenadas e o sufixo "Portugal" para a morada ler-se bem na tabela. */
export function limparMorada(m: string | null): string {
  if (!m) return '—'
  return (
    m
      .replace(/\s*\([^)]*\)/g, '') // coordenadas entre parênteses
      .replace(/,?\s*Portugal\s*$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .trim() || '—'
  )
}

/** RRAL legível (só o número; valores tipo "NOTAPPLICABLE" → —). */
export function rralLegivel(r: string | null): string {
  if (!r) return '—'
  return normalizeRral(r) || '—'
}
