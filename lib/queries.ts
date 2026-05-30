import { query } from './db'

// Sem DATABASE_URL (ex.: preview local sem BD) as leituras devolvem vazio,
// em vez de rebentar — o dashboard mostra estados vazios.
const semDb = () => !process.env.DATABASE_URL

export type SuspeitoView = {
  id: number
  nome: string
  morada: string | null
  ilha: string | null
  url: string
  rral_detetado: string | null
  motivo: string
  estado: string
  criado_em: string
}

export async function listarSuspeitos(filtros: {
  estado?: string
  ilha?: string
  motivo?: string
}): Promise<SuspeitoView[]> {
  if (semDb()) return []
  const where: string[] = []
  const params: unknown[] = []
  if (filtros.estado) {
    params.push(filtros.estado)
    where.push(`s.estado = $${params.length}`)
  }
  if (filtros.ilha) {
    params.push(filtros.ilha)
    where.push(`a.ilha = $${params.length}`)
  }
  if (filtros.motivo) {
    params.push(filtros.motivo)
    where.push(`s.motivo = $${params.length}`)
  }
  return query<SuspeitoView>(
    `SELECT s.id, a.nome, a.morada, a.ilha, a.url, a.rral_detetado,
            s.motivo, s.estado, s.criado_em
       FROM suspeitos s
       JOIN alojamentos a ON a.id = s.alojamento_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY s.criado_em DESC
       LIMIT 500`,
    params,
  )
}

export type AlojamentoView = {
  id: number
  nome: string
  morada: string | null
  ilha: string | null
  rral_detetado: string | null
  url: string
  visto_em: string
  suspeito: boolean
}

export async function listarAlojamentos(q?: string): Promise<AlojamentoView[]> {
  if (semDb()) return []
  const params: unknown[] = []
  let filtro = ''
  if (q) {
    params.push(`%${q.toLowerCase()}%`)
    filtro = `WHERE lower(a.nome) LIKE $1 OR lower(coalesce(a.morada,'')) LIKE $1`
  }
  return query<AlojamentoView>(
    `SELECT a.id, a.nome, a.morada, a.ilha, a.rral_detetado, a.url, a.visto_em,
            (s.id IS NOT NULL) AS suspeito
       FROM alojamentos a
       LEFT JOIN suspeitos s ON s.alojamento_id = a.id
       ${filtro}
       ORDER BY a.visto_em DESC
       LIMIT 500`,
    params,
  )
}

export type RunView = {
  id: number
  iniciado_em: string
  terminado_em: string | null
  novos: number
  suspeitos: number
  estado: string | null
  detalhe: string | null
}

export async function listarRuns(): Promise<RunView[]> {
  if (semDb()) return []
  return query<RunView>(
    `SELECT id, iniciado_em, terminado_em, novos, suspeitos, estado, detalhe
       FROM runs ORDER BY iniciado_em DESC LIMIT 60`,
  )
}

export async function contarPorEstado(): Promise<Record<string, number>> {
  if (semDb()) return {}
  const rows = await query<{ estado: string; n: string }>(
    `SELECT estado, COUNT(*) AS n FROM suspeitos GROUP BY estado`,
  )
  return Object.fromEntries(rows.map((r) => [r.estado, Number(r.n)]))
}

export type RevisaoView = {
  id: number
  titulo: string | null
  preco: string | null
  ilha: string | null
  descricao: string | null
  indicios: string | null
  url: string
  estado: string
  visto_em: string
}

export async function listarRevisao(estado?: string): Promise<RevisaoView[]> {
  if (semDb()) return []
  const params: unknown[] = []
  let filtro = ''
  if (estado) {
    params.push(estado)
    filtro = 'WHERE estado = $1'
  }
  return query<RevisaoView>(
    `SELECT id, titulo, preco, ilha, descricao, indicios, url, estado, visto_em
       FROM fb_revisao ${filtro} ORDER BY visto_em DESC LIMIT 500`,
    params,
  )
}
