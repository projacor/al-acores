import './env'
import { initSchema, query, getPool } from '../lib/db'
import { fetchAirbnbAzores } from '../lib/airbnb/zenrows'
import { classificar } from '../lib/match'
import { existeNoPortal } from '../lib/registo/sitesearch'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Pesquisa Airbnb nos Açores (via ZenRows), cruza cada listagem com o registo
 * (nome + pesquisa no portal — o Airbnb não dá nº de registo nem morada exata).
 * As que NÃO estão no registo vão para revisão manual (fb_revisao, fonte=airbnb).
 */
async function main() {
  await initSchema()
  const log = (m: string) => console.log(`[airbnb] ${new Date().toISOString()} ${m}`)

  const itens = await fetchAirbnbAzores(log)

  let registados = 0
  let novos = 0
  for (const it of itens) {
    // Alguns hosts põem o nº de registo no título ("AL/3030", "RRAL 1234").
    const rralTitulo =
      it.nome.match(/\b(?:RRAL|A\.?L\.?)[\s/:.-]*(\d{2,6}(?:\/\d{2,4})?)/i)?.[1] || null

    // 1) Cruzar por nome (+ RRAL do título, se houver) contra o registo.
    const c = await classificar({ nome: it.nome, morada: null, rralDetetado: rralTitulo })
    let registado = c.registado
    // 2) Fallback: pesquisa o nome no portal do governo.
    if (!registado) {
      try {
        registado = !!(await existeNoPortal(it.nome))
      } catch {
        /* portal indisponível → trata como não encontrado */
      }
      await sleep(300)
    }
    if (registado) {
      registados++
      continue
    }
    // 3) Não encontrado → revisão manual.
    const res = await query<{ id: number }>(
      `INSERT INTO fb_revisao (fb_id, titulo, ilha, indicios, url, fonte)
       VALUES ($1, $2, $3, $4, $5, 'airbnb')
       ON CONFLICT (fb_id) DO NOTHING
       RETURNING id`,
      [`airbnb_${it.airbnbId}`, it.nome, it.ilha, 'Airbnb (sem registo encontrado)', it.url],
    )
    if (res.length) novos++
  }

  log(`Concluído: ${itens.length} listagens · ${registados} já no registo · ${novos} novos para revisão.`)
  await getPool().end()
}

main().catch((e) => {
  console.error('[airbnb] falha:', e)
  process.exit(1)
})
