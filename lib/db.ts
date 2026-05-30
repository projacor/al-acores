import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL não está definida.')
    }
    pool = new Pool({
      connectionString,
      // Railway Postgres exige SSL; em local (localhost) desligamos.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

/** Atalho tipado para queries. */
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[])
  return res.rows as T[]
}

/** Cria as tabelas se ainda não existirem (idempotente). */
export async function initSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS registo_al (
      id            SERIAL PRIMARY KEY,
      slug          TEXT UNIQUE,
      rral          TEXT,
      nome          TEXT NOT NULL,
      nome_norm     TEXT NOT NULL,
      morada        TEXT,
      morada_norm   TEXT,
      ilha          TEXT,
      fonte         TEXT NOT NULL,
      atualizado_em TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_registo_rral ON registo_al (rral);
    CREATE INDEX IF NOT EXISTS idx_registo_nome_norm ON registo_al (nome_norm);

    CREATE TABLE IF NOT EXISTS alojamentos (
      id            SERIAL PRIMARY KEY,
      booking_id    TEXT UNIQUE NOT NULL,
      nome          TEXT NOT NULL,
      morada        TEXT,
      ilha          TEXT,
      rral_detetado TEXT,
      url           TEXT NOT NULL,
      visto_em      TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS suspeitos (
      id            SERIAL PRIMARY KEY,
      alojamento_id INTEGER REFERENCES alojamentos(id) UNIQUE,
      motivo        TEXT NOT NULL,
      estado        TEXT NOT NULL DEFAULT 'novo',
      evidencia     JSONB,
      criado_em     TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS runs (
      id            SERIAL PRIMARY KEY,
      iniciado_em   TIMESTAMPTZ DEFAULT now(),
      terminado_em  TIMESTAMPTZ,
      novos         INTEGER DEFAULT 0,
      suspeitos     INTEGER DEFAULT 0,
      estado        TEXT,
      detalhe       TEXT
    );
  `)
}
