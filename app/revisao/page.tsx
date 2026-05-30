import { listarRevisao } from '@/lib/queries'
import { EstadoBadge } from '@/components/EstadoBadge'
import { RevisaoActions } from '@/components/RevisaoActions'

export const dynamic = 'force-dynamic'

export default async function RevisaoPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const { estado } = await searchParams
  const lista = await listarRevisao(estado)

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Revisão — Facebook & Airbnb</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Anúncios do <b>FB Marketplace</b> (curta-duração/turístico) e do <b>Airbnb</b> cujo nome
          não foi encontrado no registo. Sem número RRAL nem morada exata, por isso{' '}
          <b>não são auto-verificados</b> — cada caso precisa de confirmação manual.
        </p>
      </div>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          Sem anúncios para revisão. Corre <code className="font-mono">npm run fb</code> para popular.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[15%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Anúncio</th>
                <th className="px-3 py-2 font-medium">Fonte</th>
                <th className="px-3 py-2 font-medium">Zona</th>
                <th className="px-3 py-2 font-medium">Preço</th>
                <th className="px-3 py-2 font-medium">Indícios</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 align-top">
              {lista.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <a
                      href={r.url}
                      target="_blank"
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {r.titulo || '(sem título)'}
                    </a>
                    {r.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{r.descricao}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.fonte === 'airbnb'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {r.fonte === 'airbnb' ? 'Airbnb' : 'Facebook'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.ilha ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.preco ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-amber-700">{r.indicios ?? '—'}</td>
                  <td className="px-3 py-2">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="px-3 py-2">
                    <RevisaoActions id={r.id} estado={r.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
