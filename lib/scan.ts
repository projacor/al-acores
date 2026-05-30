import { query, initSchema } from './db'
import { fetchBookingApify, type BookingItem } from './booking/apify'
import { classificar, type Motivo } from './match'
import { refreshAzores } from './registo/azores'
import { refreshRnal } from './registo/rnal'
import { existeNoPortal } from './registo/sitesearch'
import { enviarRelatorio, type SuspeitoEmail } from './email'

const REGISTO_MAX_IDADE_DIAS = 7
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Tipos do Booking que NÃO são alojamento local (têm RNET, não RRAL) — ignorados.
const TIPOS_FORA = new Set(['hotel', 'resort', 'motel'])

export type ScanResultado = {
  runId: number
  novos: number
  suspeitos: number
  estado: 'ok' | 'bloqueado' | 'erro'
  detalhe?: string
}

function log(m: string) {
  console.log(`[scan] ${new Date().toISOString()} ${m}`)
}

/** Garante que o índice do registo não está obsoleto. */
async function garantirRegisto(): Promise<void> {
  const [row] = await query<{ idade: number | null; total: string }>(
    `SELECT EXTRACT(EPOCH FROM (now() - MAX(atualizado_em)))/86400 AS idade,
            COUNT(*) AS total
       FROM registo_al`,
  )
  const vazio = Number(row?.total ?? 0) === 0
  const obsoleto = row?.idade == null || Number(row.idade) > REGISTO_MAX_IDADE_DIAS
  if (vazio || obsoleto) {
    log('Índice do registo obsoleto/vazio — a atualizar a partir do portal dos Açores...')
    const r = await refreshAzores({ log })
    await refreshRnal(log)
    log(`Registo atualizado: ${r.total} AL, ${r.enriquecidos} detalhes enriquecidos.`)
  } else {
    log(`Índice do registo fresco (${Number(row.idade).toFixed(1)} dias).`)
  }
}

/** Pipeline completo de uma execução diária. */
export async function correrScan(): Promise<ScanResultado> {
  await initSchema()
  const [run] = await query<{ id: number }>(
    `INSERT INTO runs (estado) VALUES ('a_correr') RETURNING id`,
  )
  const runId = run.id

  let estado: ScanResultado['estado'] = 'ok'
  let detalhe: string | undefined
  let novos = 0
  const novosSuspeitos: SuspeitoEmail[] = []

  try {
    await garantirRegisto()

    const maxListings = Number(process.env.MAX_LISTINGS || 0)

    // 1) Pesquisar o Booking via Apify (cobertura completa da região).
    const items = await fetchBookingApify(log)

    // 2) Filtrar hotéis (fora do âmbito AL) e os já vistos.
    const candidatos = items.filter((it) => !it.tipo || !TIPOS_FORA.has(it.tipo))
    const novosItens: BookingItem[] = []
    for (const it of candidatos) {
      const [existe] = await query<{ id: number }>(
        `SELECT id FROM alojamentos WHERE booking_id = $1`,
        [it.bookingId],
      )
      if (!existe) novosItens.push(it)
    }
    const alvo = maxListings > 0 ? novosItens.slice(0, maxListings) : novosItens
    log(
      `${items.length} do Apify · ${candidatos.length} AL (sem hotéis) · ` +
        `${novosItens.length} novos (a processar ${alvo.length}).`,
    )

    // 3) Persistir e classificar cada anúncio novo.
    for (const data of alvo) {
      const [aloj] = await query<{ id: number }>(
        `INSERT INTO alojamentos (booking_id, nome, morada, ilha, rral_detetado, url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (booking_id) DO NOTHING
         RETURNING id`,
        [data.bookingId, data.nome, data.morada, data.ilha, data.rralDetetado, data.url],
      )
      novos++
      if (!aloj) continue

      const c = await classificar({
        nome: data.nome,
        morada: data.morada,
        rralDetetado: data.rralDetetado,
      })

      // Fallback: se o índice não casou, pesquisa o nome no portal do governo.
      let portalSlug: string | null = null
      if (!c.registado) {
        try {
          portalSlug = await existeNoPortal(data.nome)
        } catch {
          /* portal indisponível → mantém como suspeito para revisão */
        }
        await sleep(300) // ser educado com o portal
      }

      if (!c.registado && !portalSlug) {
        const motivo: Motivo = data.rralDetetado ? 'rral_nao_encontrado' : 'sem_rral'
        await query(
          `INSERT INTO suspeitos (alojamento_id, motivo, evidencia)
           VALUES ($1, $2, $3)
           ON CONFLICT (alojamento_id) DO NOTHING`,
          [aloj.id, motivo, JSON.stringify({ alvo: data, classificacao: c })],
        )
        novosSuspeitos.push({
          nome: data.nome,
          morada: data.morada,
          ilha: data.ilha,
          url: data.url,
          motivo,
        })
      }
    }
  } catch (e) {
    estado = 'erro'
    detalhe = (e as Error).message
    log(`ERRO: ${detalhe}`)
  }

  await query(
    `UPDATE runs SET terminado_em = now(), novos = $2, suspeitos = $3, estado = $4, detalhe = $5
      WHERE id = $1`,
    [runId, novos, novosSuspeitos.length, estado, detalhe ?? null],
  )

  // Relatório por email (mesmo que 0 suspeitos, para confirmar que correu).
  try {
    await enviarRelatorio(novosSuspeitos, { novos, estado })
  } catch (e) {
    log(`Falha no envio de email: ${(e as Error).message}`)
  }

  log(`Concluído: ${novos} novos, ${novosSuspeitos.length} suspeitos, estado=${estado}.`)
  return { runId, novos, suspeitos: novosSuspeitos.length, estado, detalhe }
}
