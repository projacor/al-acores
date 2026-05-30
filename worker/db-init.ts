import './env'
import { initSchema, getPool } from '../lib/db'

async function main() {
  await initSchema()
  console.log('[db] Schema criado/atualizado.')
  await getPool().end()
}

main().catch((e) => {
  console.error('[db] falha:', e)
  process.exit(1)
})
