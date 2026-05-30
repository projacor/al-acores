import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'AL Açores — Deteção de alojamentos irregulares',
  description: 'Cruzamento de anúncios do Booking com o registo regional de AL dos Açores.',
}

const NAV = [
  { href: '/', label: 'Suspeitos' },
  { href: '/alojamentos', label: 'Alojamentos' },
  { href: '/runs', label: 'Execuções' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen antialiased">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
            <span className="font-semibold tracking-tight">🏝️ AL Açores</span>
            <nav className="flex gap-4 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-gray-600 hover:text-black">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
