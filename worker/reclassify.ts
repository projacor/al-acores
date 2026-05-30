import './env'
import { query, getPool } from '../lib/db'
import { classificar } from '../lib/match'
import { existeNoPortal } from '../lib/registo/sitesearch'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Re-avalia todos os alojamentos já gravados contra o registo atual, sem
 * voltar a fazer scraping. Reconstrói a tabela de suspeitos. Útil para afinar
 * o matcher sem custo de Apify.
 */
async function main() {
  const als = await query<{
    id: number
    nome: string
    morada: string | null
    rral_detetado: string | null
  }>(`SELECT id, nome, morada, rral_detetado FROM alojamentos`)

  await query('DELETE FROM suspeitos')
  let suspeitos = 0
  for (const a of als) {
    const c = await classificar({
      nome: a.nome,
      morada: a.morada,
      rralDetetado: a.rral_detetado,
    })
    let portalSlug: string | null = null
    if (!c.registado) {
      try {
        portalSlug = await existeNoPortal(a.nome)
      } catch {
        /* portal indisponível → mantém suspeito */
      }
      await sleep(300)
    }
    if (!c.registado && !portalSlug) {
      const motivo = a.rral_detetado ? 'rral_nao_encontrado' : 'sem_rral'
      await query(
        `INSERT INTO suspeitos (alojamento_id, motivo, evidencia)
         VALUES ($1, $2, $3) ON CONFLICT (alojamento_id) DO NOTHING`,
        [a.id, motivo, JSON.stringify({ reclassify: true })],
      )
      suspeitos++
    }
  }
  console.log(`Reclassificados ${als.length} alojamentos → ${suspeitos} suspeitos.`)
  await getPool().end()
}

main().catch((e) => {
  console.error('[reclassify] falha:', e)
  process.exit(1)
})
