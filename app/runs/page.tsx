import { listarRuns } from '@/lib/queries'
import { EstadoBadge } from '@/components/EstadoBadge'

export const dynamic = 'force-dynamic'

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-PT', { timeZone: 'Atlantic/Azores' })
}

export default async function RunsPage() {
  const runs = await listarRuns()
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Execuções</h1>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Início</th>
              <th className="px-3 py-2 font-medium">Fim</th>
              <th className="px-3 py-2 font-medium">Novos</th>
              <th className="px-3 py-2 font-medium">Suspeitos</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runs.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{fmt(r.iniciado_em)}</td>
                <td className="px-3 py-2 text-gray-600">{fmt(r.terminado_em)}</td>
                <td className="px-3 py-2 text-gray-600">{r.novos}</td>
                <td className="px-3 py-2 text-gray-600">{r.suspeitos}</td>
                <td className="px-3 py-2">{r.estado ? <EstadoBadge estado={r.estado} /> : '—'}</td>
                <td className="px-3 py-2 text-gray-500">{r.detalhe ?? '—'}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Ainda não há execuções.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
