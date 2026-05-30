import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'
import { listarSuspeitos } from '@/lib/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const suspeitos = await listarSuspeitos({
    estado: sp.get('estado') || undefined,
    ilha: sp.get('ilha') || undefined,
    motivo: sp.get('motivo') || undefined,
  })
  return NextResponse.json(suspeitos)
}

const PatchSchema = z.object({
  id: z.number().int().positive(),
  estado: z.enum(['novo', 'confirmado', 'descartado']),
})

export async function PATCH(req: NextRequest) {
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Payload inválido' }, { status: 400 })
  }
  const { id, estado } = parsed.data
  await query(`UPDATE suspeitos SET estado = $2 WHERE id = $1`, [id, estado])
  return NextResponse.json({ ok: true })
}
