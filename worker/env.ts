// Carrega variáveis de .env em execução local (no Railway vêm do ambiente).
// Importar este módulo ANTES de qualquer código que leia process.env.
try {
  // process.loadEnvFile existe no Node 20.12+ (cá: 20.20).
  ;(process as unknown as { loadEnvFile: (p?: string) => void }).loadEnvFile('.env')
} catch {
  // Sem ficheiro .env (produção) — ignorar.
}
