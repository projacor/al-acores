import { Resend } from 'resend'

export type SuspeitoEmail = {
  nome: string
  morada: string | null
  ilha: string | null
  url: string
  motivo: string
}

const MOTIVO_LABEL: Record<string, string> = {
  sem_rral: 'Sem nº RRAL visível no anúncio',
  rral_nao_encontrado: 'RRAL no anúncio não consta do registo',
  nome_morada_nao_encontrados: 'Não encontrado no registo (nome/morada)',
}

/** Envia o relatório diário com os novos suspeitos. No-op se faltar config. */
export async function enviarRelatorio(
  suspeitos: SuspeitoEmail[],
  resumo: { novos: number; estado: string },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = process.env.EMAIL_TO
  if (!apiKey || !from || !to) {
    console.warn('[email] RESEND_API_KEY/EMAIL_FROM/EMAIL_TO em falta — email ignorado.')
    return
  }

  const resend = new Resend(apiKey)
  const hoje = new Date().toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' })

  const linhas = suspeitos
    .map(
      (s) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(s.nome)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(s.ilha ?? '—')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(s.morada ?? '—')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${MOTIVO_LABEL[s.motivo] ?? s.motivo}</td>
        <td style="padding:8px;border-bottom:1px solid #eee"><a href="${s.url}">ver</a></td>
      </tr>`,
    )
    .join('')

  const corpo =
    suspeitos.length === 0
      ? `<p>Sem novos alojamentos suspeitos hoje. Estado da execução: <b>${resumo.estado}</b>.</p>`
      : `
      <p><b>${suspeitos.length}</b> novos alojamentos possivelmente irregulares (${hoje}).</p>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;width:100%">
        <thead><tr style="text-align:left;background:#f6f6f6">
          <th style="padding:8px">Nome</th><th style="padding:8px">Ilha</th>
          <th style="padding:8px">Morada</th><th style="padding:8px">Motivo</th>
          <th style="padding:8px"></th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">
        "Suspeito" não significa "ilegal". Cada caso requer verificação manual no dashboard.
      </p>`

  await resend.emails.send({
    from,
    to: to.split(',').map((s) => s.trim()),
    subject: `[AL Açores] ${suspeitos.length} novos suspeitos — ${hoje}`,
    html: `<div style="font-family:sans-serif;color:#222">${corpo}</div>`,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
