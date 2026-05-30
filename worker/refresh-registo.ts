import './env'
import { initSchema, getPool } from '../lib/db'
import { refreshAzores } from '../lib/registo/azores'
import { refreshRnal } from '../lib/registo/rnal'

async function main() {
  await initSchema()
  const log = (m: string) => console.log(`[registo] ${m}`)
  const r = await refreshAzores({ log })
  await refreshRnal(log)
  log(`Concluído: ${r.total} AL na lista-mestra, ${r.enriquecidos} detalhes enriquecidos.`)
  await getPool().end()
}

main().catch((e) => {
  console.error('[registo] falha:', e)
  process.exit(1)
})
