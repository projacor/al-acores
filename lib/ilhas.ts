/** As nove ilhas dos Açores, com termos de pesquisa para o Booking. */
export const ILHAS = [
  'Santa Maria',
  'São Miguel',
  'Terceira',
  'Graciosa',
  'São Jorge',
  'Pico',
  'Faial',
  'Flores',
  'Corvo',
] as const

export type Ilha = (typeof ILHAS)[number]

/** Lê a env ILHAS (CSV) e devolve a lista a processar (vazio = todas). */
export function ilhasSelecionadas(): readonly Ilha[] {
  const raw = (process.env.ILHAS || '').trim()
  if (!raw) return ILHAS
  const pedidas = raw.split(',').map((s) => s.trim().toLowerCase())
  return ILHAS.filter((i) => pedidas.includes(i.toLowerCase()))
}
