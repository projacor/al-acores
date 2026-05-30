# AL Açores — Deteção de alojamentos locais possivelmente irregulares

Aplicação que, **todos os dias às 09:00 (Europe/Lisbon)**, pesquisa anúncios de
alojamento local nos Açores no **Booking.com**, verifica se cada anúncio exibe o
número **RRAL** e cruza nome/morada/RRAL com o **registo regional** em
`turismo.azores.gov.pt`. Os anúncios que não constem do registo entram numa
**tabela de suspeitos**, visível no dashboard e enviada por **email diário**.

> ⚠️ "Suspeito" ≠ "ilegal". Há falsos positivos no cruzamento por nome/morada —
> cada caso requer verificação manual. O scraping do Booking.com contraria os
> Termos de Serviço deles e pode ser bloqueado; é uma ferramenta de fiscalização.

## Arquitetura

- **Dashboard** (`app/`) — Next.js 16, mostra suspeitos, alojamentos e execuções.
- **Worker** (`worker/scan.ts`) — pipeline diário (Playwright + cruzamento + email).
- **Registo** (`lib/registo/azores.ts`) — índice de AL via `/al-map/` (lista-mestra)
  e páginas `/pin/` (RRAL + morada). HTML estático, sem browser.
- **Booking** (`lib/booking/`) — pesquisa e leitura de anúncios com Playwright.
- **Postgres** — `registo_al`, `alojamentos`, `suspeitos`, `runs`.

## Desenvolvimento local

```bash
cp .env.example .env          # preencher DATABASE_URL, RESEND_*, tokens
npm install
npx playwright install chromium
npm run db:init               # cria as tabelas
npm run registo:refresh       # popula o índice do registo dos Açores
ILHAS=Corvo MAX_LISTINGS=5 npm run scan   # teste rápido numa ilha pequena
npm run dev                   # dashboard em http://localhost:3000
```

Variáveis úteis: `ILHAS` (CSV, vazio=todas), `MAX_LISTINGS` (0=sem limite),
`SCRAPE_DELAY_MS`, `REGISTO_ENRICH_LIMIT` (limita detalhes por refresh).

## Deploy no Railway

O build usa o **Dockerfile** (imagem oficial do Playwright, já com Chromium).

1. **Postgres** — adicionar o plugin (injeta `DATABASE_URL`).
2. **Serviço `web`** — deste repo; build por Dockerfile, start `npm start`. Variáveis:
   `DATABASE_URL`, `DASHBOARD_PASSWORD`, `RUN_TOKEN`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `EMAIL_TO`.
3. **Serviço `worker`** — mesmo repo/Dockerfile; **Start Command** `npm run scan`,
   **Cron Schedule** `0 9 * * *`, variável `TZ=Europe/Lisbon`. Mesmas variáveis.

Ver `railway.worker.json` para referência da config do worker.

## Disparo manual do scan

```bash
curl -X POST "https://<web>/api/run?token=$RUN_TOKEN"        # background (202)
curl -X POST "https://<web>/api/run?token=$RUN_TOKEN&wait=1" # espera o resultado
```
