'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RevisaoActions({ id, estado }: { id: number; estado: string }) {
  const router = useRouter()
  const [a_guardar, setGuardar] = useState(false)

  async function mudar(novo: string) {
    setGuardar(true)
    try {
      await fetch('/api/revisao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: novo }),
      })
      router.refresh()
    } finally {
      setGuardar(false)
    }
  }

  return (
    <div className="flex gap-1">
      {estado !== 'confirmado' && (
        <button
          onClick={() => mudar('confirmado')}
          disabled={a_guardar}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Confirmar AL
        </button>
      )}
      {estado !== 'descartado' && (
        <button
          onClick={() => mudar('descartado')}
          disabled={a_guardar}
          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Descartar
        </button>
      )}
      {estado !== 'novo' && (
        <button
          onClick={() => mudar('novo')}
          disabled={a_guardar}
          className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          Reabrir
        </button>
      )}
    </div>
  )
}
