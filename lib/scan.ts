import { query, initSchema } from './db'
import { launchBrowser, newContext, sleep, BlockedError } from './browser'
import { ilhasSelecionadas } from './ilhas'
import { searchIlha, type ListingRef } from './booking/search'
import { scrapeListing } from './booking/listing'
import { classificar, type Motivo } from './match'
import { refreshAzores } from './registo/azores'
import { refreshRnal } from './registo/rnal'
import { enviarRelatorio, type SuspeitoEmail } from './email'

const REGISTO_MAX_IDADE_DIAS = 7

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
    const r = await refreshAzores({ log, delayMs: Number(process.env.SCRAPE_DELAY_MS || 800) })
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

    const delayMs = Number(process.env.SCRAPE_DELAY_MS || 4000)
    const maxListings = Number(process.env.MAX_LISTINGS || 0)
    const browser = await launchBrowser()
    const ctx = await newContext(browser)

    try {
      // 1) Pesquisar Booking por ilha e juntar referências.
      const refs: ListingRef[] = []
      for (const ilha of ilhasSelecionadas()) {
        log(`A pesquisar Booking: ${ilha}...`)
        const r = await searchIlha(ctx, ilha, delayMs)
        log(`  ${r.length} anúncios encontrados em ${ilha}.`)
        refs.push(...r)
        await sleep(delayMs)
      }

      // 2) Filtrar os já vistos (não repetir AL).
      const novosRefs: ListingRef[] = []
      for (const ref of refs) {
        const [existe] = await query<{ id: number }>(
          `SELECT id FROM alojamentos WHERE booking_id = $1`,
          [ref.bookingId],
        )
        if (!existe) novosRefs.push(ref)
      }
      const alvo = maxListings > 0 ? novosRefs.slice(0, maxListings) : novosRefs
      log(`${novosRefs.length} novos anúncios (a processar ${alvo.length}).`)

      // 3) Processar cada anúncio novo.
      for (const ref of alvo) {
        const data = await scrapeListing(ctx, ref)
        const [aloj] = await query<{ id: number }>(
          `INSERT INTO alojamentos (booking_id, nome, morada, ilha, rral_detetado, url)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (booking_id) DO NOTHING
           RETURNING id`,
          [data.bookingId, data.nome, data.morada, data.ilha, data.rralDetetado, data.url],
        )
        novos++
        if (!aloj) continue // corrida: já inserido entretanto

        const c = await classificar({
          nome: data.nome,
          morada: data.morada,
          rralDetetado: data.rralDetetado,
        })
        if (!c.registado) {
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
        await sleep(delayMs)
      }
    } finally {
      await ctx.close()
      await browser.close()
    }
  } catch (e) {
    if (e instanceof BlockedError) {
      estado = 'bloqueado'
      detalhe = e.message
      log(`BLOQUEADO: ${e.message}`)
    } else {
      estado = 'erro'
      detalhe = (e as Error).message
      log(`ERRO: ${detalhe}`)
    }
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
