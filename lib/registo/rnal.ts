/**
 * Reforço opcional: Registo Nacional de Alojamento Local (RNAL),
 * em rnt.turismodeportugal.pt. É um formulário ASP.NET com postback, pesado de
 * automatizar e redundante para os Açores (o portal regional já é a fonte
 * autoritativa e completa via /al-map/). Fica como ponto de extensão.
 *
 * Desativado por omissão. Ativar com RNAL_ENABLED=1 quando/se for implementado.
 */
export async function refreshRnal(log?: (m: string) => void): Promise<number> {
  if (process.env.RNAL_ENABLED !== '1') {
    log?.('RNAL desativado (reforço opcional) — a usar apenas o portal dos Açores.')
    return 0
  }
  log?.('RNAL: integração ainda não implementada; sem alterações.')
  return 0
}
