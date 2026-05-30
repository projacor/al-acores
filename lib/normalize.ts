/** Utilitários de normalização e extração de números de registo (RRAL). */

// Palavras-ruído removidas antes de comparar nomes de estabelecimentos.
const NOISE_WORDS = new Set([
  'alojamento', 'local', 'al', 'lda', 'unipessoal', 'sociedade',
  'turismo', 'hospedagem', 'guest', 'house', 'guesthouse', 'apartamento',
  'apartamentos', 'moradia', 'casa', 'the', 'by', 'e', 'de', 'da', 'do',
  'dos', 'das', 'em', 'a', 'o',
])

// Abreviaturas de morada → forma canónica.
const ADDR_ABBR: Record<string, string> = {
  'r': 'rua', 'av': 'avenida', 'avn': 'avenida', 'tv': 'travessa',
  'lg': 'largo', 'pc': 'praca', 'pca': 'praca', 'praça': 'praca',
  'estr': 'estrada', 'cam': 'caminho', 'cª': 'canada', 'canª': 'canada',
  'n': 'numero', 'nº': 'numero', 'no': 'numero',
}

/** Remove acentos, baixa para minúsculas e colapsa espaços. */
export function deburr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tokens significativos de um nome (sem ruído nem pontuação). */
export function nameTokens(s: string): string[] {
  return deburr(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !NOISE_WORDS.has(t))
}

/** Nome normalizado para indexar/comparar. */
export function normalizeName(s: string): string {
  return nameTokens(s).sort().join(' ')
}

/**
 * Extrai o nome comercial de um título do registo. Os títulos seguem o padrão
 * «Entidade Lda – "Nome Comercial"» ou «Entidade – Nome Comercial». O Booking
 * mostra só o nome comercial, por isso é por aí que devemos comparar.
 */
export function commercialName(s: string): string {
  // 1) Parte entre aspas, se existir.
  const quoted = s.match(/"([^"]+)"/)
  if (quoted && quoted[1].trim()) return quoted[1].trim()
  // 2) Parte depois do último travessão/hífen separador.
  const parts = s.split(/\s[–—-]\s|–|—/)
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim()
    if (last) return last
  }
  return s.trim()
}

/** Morada normalizada (abreviaturas expandidas, sem pontuação). */
export function normalizeAddress(s: string): string {
  return deburr(s)
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .map((t) => ADDR_ABBR[t] ?? t)
    .filter((t) => t && t !== 'numero')
    .join(' ')
    .trim()
}

/**
 * Tenta extrair um número de registo de AL do texto de uma página.
 * Cobre formatos comuns: "RRAL 12345", "Registo nº 1234/2020",
 * "Nº de registo: 123456", "license number 12345".
 */
export function extractRral(text: string): string | null {
  const haystack = text.replace(/\s+/g, ' ')
  const patterns = [
    /\bRRAL\s*[:nº.\-]*\s*([0-9]{2,6}(?:\/[0-9]{2,4})?)/i,
    /\bregisto\s*(?:n[ºo.]?|numero|nr)?\s*[:.\-]?\s*([0-9]{2,6}(?:\/[0-9]{2,4})?)/i,
    /\bn[ºo]\s*de\s*registo\s*[:.\-]?\s*([0-9]{2,6}(?:\/[0-9]{2,4})?)/i,
    /\b(?:license|licence)\s*(?:number|n[ºo.]?)?\s*[:.\-]?\s*([0-9]{2,6}(?:\/[0-9]{2,4})?)/i,
  ]
  for (const re of patterns) {
    const m = haystack.match(re)
    if (m) return normalizeRral(m[1])
  }
  return null
}

/** Normaliza um número RRAL para comparação (só dígitos e barra). */
export function normalizeRral(s: string): string {
  return s.replace(/[^0-9/]/g, '').replace(/^0+/, '')
}

/** Similaridade de Jaccard entre dois conjuntos de tokens. */
export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

/** Distância de Levenshtein normalizada → similaridade em [0,1]. */
export function levenshteinSim(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => i)
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i]
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      prev = tmp
    }
  }
  return 1 - dp[m] / Math.max(m, n)
}
