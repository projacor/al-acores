import { listarAlojamentos } from '@/lib/queries'
import { limparMorada, rralLegivel } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AlojamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const lista = await listarAlojamentos(q)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alojamentos vistos</h1>
          <p className="mt-1 text-sm text-gray-500">{lista.length} anúncios (máx. 500)</p>
        </div>
        <form action="/alojamentos" method="get">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Pesquisar nome ou morada…"
            className="w-64 rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[12%]" />
            <col className="w-[34%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Ilha</th>
              <th className="px-3 py-2 font-medium">Morada</th>
              <th className="px-3 py-2 font-medium">RRAL</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {lista.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <a
                    href={a.url}
                    target="_blank"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {a.nome}
                  </a>
                </td>
                <td className="px-3 py-2 text-gray-600">{a.ilha ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{limparMorada(a.morada)}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">
                  {rralLegivel(a.rral_detetado)}
                </td>
                <td className="px-3 py-2">
                  {a.suspeito ? (
                    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      suspeito
                    </span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      registado
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
