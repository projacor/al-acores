import { NextRequest, NextResponse } from 'next/server'
import { correrScan } from '@/lib/scan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// O scan pode demorar; damos margem máxima ao handler.
export const maxDuration = 800

/**
 * Disparo manual do scan (para testes). Protegido por RUN_TOKEN.
 * POST /api/run?token=...  ou  header  x-run-token: ...
 * Por omissão devolve 202 e corre em segundo plano; ?wait=1 espera o resultado.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.RUN_TOKEN
  const given = req.nextUrl.searchParams.get('token') || req.headers.get('x-run-token')
  if (!expected || given !== expected) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  if (req.nextUrl.searchParams.get('wait') === '1') {
    try {
      const r = await correrScan()
      return NextResponse.json(r)
    } catch (e) {
      const err = e as { message?: string; code?: string; name?: string; stack?: string }
      return NextResponse.json(
        {
          erro: 'Scan falhou',
          detalhe: err?.message || String(e),
          code: err?.code,
          name: err?.name,
          stack: err?.stack?.split('\n').slice(0, 4),
        },
        { status: 500 },
      )
    }
  }

  // Fire-and-forget: corre em segundo plano no processo do servidor.
  correrScan().catch((e) => console.error('[api/run] scan falhou:', e))
  return NextResponse.json({ ok: true, mensagem: 'Scan iniciado.' }, { status: 202 })
}
