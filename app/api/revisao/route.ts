import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  await query(`UPDATE fb_revisao SET estado = $2 WHERE id = $1`, [id, estado])
  return NextResponse.json({ ok: true })
}
