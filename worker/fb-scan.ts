import './env'
import { initSchema, query, getPool } from '../lib/db'
import { fetchFbAzores } from '../lib/fb/marketplace'
import { analisar } from '../lib/fb/filtro'

/**
 * Pesquisa o FB Marketplace nos Açores, filtra anúncios com indícios de
 * curta-duração/turístico e grava os novos em fb_revisao (revisão manual).
 * Stream separado dos suspeitos do Booking — aqui não há cruzamento com o
 * registo (o FB não tem RRAL/morada), por isso é tudo para revisão humana.
 */
async function main() {
  await initSchema()
  const log = (m: string) => console.log(`[fb] ${new Date().toISOString()} ${m}`)

  const items = await fetchFbAzores(log)

  let curta = 0
  let novos = 0
  for (const it of items) {
    const a = analisar(`${it.titulo}\n${it.descricao}`)
    if (!a.curtaDuracao) continue // só curta-duração/turístico
    curta++
    const res = await query<{ id: number }>(
      `INSERT INTO fb_revisao (fb_id, titulo, preco, ilha, descricao, indicios, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (fb_id) DO NOTHING
       RETURNING id`,
      [it.fbId, it.titulo, it.preco, it.ilha, it.descricao.slice(0, 2000), a.indicios.join(', '), it.url],
    )
    if (res.length) novos++
  }

  log(`Concluído: ${items.length} anúncios · ${curta} com indícios de curta-duração · ${novos} novos.`)
  await getPool().end()
}

main().catch((e) => {
  console.error('[fb] falha:', e)
  process.exit(1)
})
