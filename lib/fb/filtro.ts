/**
 * Deteta indícios de alojamento de CURTA DURAÇÃO / turístico no texto de um
 * anúncio do FB Marketplace. Só estes interessam (um AL não registado anunciado
 * informalmente); o arrendamento de longa duração não é AL e é descartado.
 */

// Sinais de curta-duração / uso turístico (PT + EN).
const CURTA = [
  'férias',
  'ferias',
  'holiday',
  'holidays',
  'vacation',
  'por noite',
  'a noite',
  '/noite',
  'diária',
  'diaria',
  'por dia',
  'per night',
  'nightly',
  'turista',
  'turístico',
  'turistico',
  'turistas',
  'tourist',
  'fim de semana',
  'fim-de-semana',
  'weekend',
  'airbnb',
  'booking',
  'alojamento local',
  'short term',
  'short-term',
  'curta duração',
  'curta duracao',
  'temporada',
  'hóspedes',
  'hospedes',
  'guests',
  'estadia',
  'nights',
  'noites',
  'época alta',
  'epoca alta',
]

// Sinais de longa duração (descartam, salvo se houver sinal forte de curta).
const LONGA = [
  'renda mensal',
  'por mês',
  'por mes',
  '/mês',
  '/mes',
  'mensal',
  'caução',
  'caucao',
  'contrato de arrendamento',
  'fiador',
  'longa duração',
  'longa duracao',
  'permanente',
  'anual',
  '12 meses',
  'meses de renda',
]

function contem(texto: string, termos: string[]): string[] {
  return termos.filter((t) => texto.includes(t))
}

export type Analise = { curtaDuracao: boolean; indicios: string[] }

/** Analisa título + descrição. Devolve indícios de curta-duração, se houver. */
export function analisar(texto: string): Analise {
  const t = texto.toLowerCase()
  const curta = contem(t, CURTA)
  const longa = contem(t, LONGA)
  return {
    curtaDuracao: curta.length > 0,
    indicios: curta.length ? curta : longa.length ? ['(longa duração)'] : [],
  }
}
