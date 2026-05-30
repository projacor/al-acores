import Link from 'next/link'
import { listarSuspeitos, contarPorEstado } from '@/lib/queries'
import { ILHAS } from '@/lib/ilhas'
import { EstadoBadge, motivoLabel } from '@/components/EstadoBadge'
import { SuspeitoActions } from '@/components/SuspeitoActions'

export const dynamic = 'force-dynamic'

const ESTADOS = ['novo', 'confirmado', 'descartado']
const MOTIVOS = ['sem_rral', 'rral_nao_encontrado', 'nome_morada_nao_encontrados']

export default async function SuspeitosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; ilha?: string; motivo?: string }>
}) {
  const sp = await searchParams
  const [suspeitos, contagem] = await Promise.all([
    listarSuspeitos(sp),
    contarPorEstado(),
  ])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suspeitos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {contagem.novo ?? 0} novos · {contagem.confirmado ?? 0} confirmados ·{' '}
            {contagem.descartado ?? 0} descartados
          </p>
        </div>
        <form className="flex flex-wrap gap-2 text-sm" action="/" method="get">
          <Filtro nome="estado" valor={sp.estado} opcoes={ESTADOS} />
          <Filtro nome="ilha" valor={sp.ilha} opcoes={[...ILHAS]} />
          <Filtro nome="motivo" valor={sp.motivo} opcoes={MOTIVOS} label={motivoLabel} />
          <button className="rounded bg-black px-3 py-1.5 text-white" type="submit">
            Filtrar
          </button>
        </form>
      </div>

      {suspeitos.length === 0 ? (
        <Vazio />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <Th>Nome</Th>
                <Th>Ilha</Th>
                <Th>Morada</Th>
                <Th>RRAL</Th>
                <Th>Motivo</Th>
                <Th>Estado</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suspeitos.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <a href={s.url} target="_blank" className="font-medium text-blue-700 hover:underline">
                      {s.nome}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{s.ilha ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{s.morada ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{s.rral_detetado ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{motivoLabel(s.motivo)}</td>
                  <td className="px-3 py-2">
                    <EstadoBadge estado={s.estado} />
                  </td>
                  <td className="px-3 py-2">
                    <SuspeitoActions id={s.id} estado={s.estado} />
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium">{children}</th>
}

function Filtro({
  nome,
  valor,
  opcoes,
  label = (s) => s,
}: {
  nome: string
  valor?: string
  opcoes: string[]
  label?: (s: string) => string
}) {
  return (
    <select
      name={nome}
      defaultValue={valor ?? ''}
      className="rounded border border-gray-300 bg-white px-2 py-1.5"
    >
      <option value="">{nome}: todos</option>
      {opcoes.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  )
}

function Vazio() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
      Sem suspeitos para os filtros atuais. Corre uma execução do scan para popular dados.
    </div>
  )
}
