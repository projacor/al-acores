import { NextRequest, NextResponse } from 'next/server'

// Protege todo o dashboard com HTTP Basic Auth (utilizador livre, password = DASHBOARD_PASSWORD).
// As rotas de API com token próprio (/api/run) são tratadas nelas mesmas.
// (Convenção `proxy` do Next.js 16 — substitui o antigo `middleware`.)
export function proxy(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return NextResponse.next() // sem password definida → aberto (dev)

  const header = req.headers.get('authorization') || ''
  if (header.startsWith('Basic ')) {
    const [, pass] = atob(header.slice(6)).split(':')
    if (pass === expected) return NextResponse.next()
  }
  return new NextResponse('Autenticação necessária', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="AL Açores"' },
  })
}

export const config = {
  // Protege páginas e API de leitura; exclui /api/run (token próprio) e estáticos.
  matcher: ['/((?!api/run|_next/static|_next/image|favicon.ico).*)'],
}
