import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 'pg' e 'playwright' são pacotes server-only — nunca os incluir no bundle do cliente.
  serverExternalPackages: ['pg', 'playwright'],
}

export default nextConfig
