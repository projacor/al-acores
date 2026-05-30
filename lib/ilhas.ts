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

/** Deduz a ilha a partir do código postal (9XXX) presente na morada. */
export function ilhaFromMorada(morada: string | null): Ilha | null {
  if (!morada) return null
  const m = morada.match(/\b(9[5-9]\d{2})-?\d{0,3}\b/)
  if (!m) return null
  const cp = Number(m[1])
  if (cp === 9580) return 'Santa Maria'
  if ((cp >= 9500 && cp <= 9579) || (cp >= 9600 && cp <= 9699)) return 'São Miguel'
  if (cp >= 9700 && cp <= 9799) return 'Terceira'
  if (cp >= 9800 && cp <= 9879) return 'São Jorge'
  if (cp >= 9880 && cp <= 9899) return 'Graciosa'
  if (cp >= 9900 && cp <= 9929) return 'Faial'
  if (cp >= 9930 && cp <= 9959) return 'Pico'
  if (cp >= 9960 && cp <= 9979) return 'Flores'
  if (cp >= 9980 && cp <= 9999) return 'Corvo'
  return null
}
