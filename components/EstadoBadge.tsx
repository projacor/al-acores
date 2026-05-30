const CORES: Record<string, string> = {
  novo: 'bg-amber-100 text-amber-800',
  confirmado: 'bg-red-100 text-red-800',
  descartado: 'bg-gray-100 text-gray-500',
  ok: 'bg-green-100 text-green-800',
  bloqueado: 'bg-orange-100 text-orange-800',
  erro: 'bg-red-100 text-red-800',
  a_correr: 'bg-blue-100 text-blue-800',
}

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        CORES[estado] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {estado}
    </span>
  )
}

const MOTIVO_LABEL: Record<string, string> = {
  sem_rral: 'Sem RRAL no anúncio',
  rral_nao_encontrado: 'RRAL não consta do registo',
  nome_morada_nao_encontrados: 'Não encontrado no registo',
}

export function motivoLabel(m: string): string {
  return MOTIVO_LABEL[m] ?? m
}
