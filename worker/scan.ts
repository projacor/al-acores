import './env'
import { correrScan } from '../lib/scan'
import { getPool } from '../lib/db'

async function main() {
  const r = await correrScan()
  await getPool().end()
  // Sai com código de erro se foi bloqueado/erro (útil para alertas do Railway).
  process.exit(r.estado === 'ok' ? 0 : 1)
}

main().catch((e) => {
  console.error('[scan] falha fatal:', e)
  process.exit(1)
})
