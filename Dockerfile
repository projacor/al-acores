# Imagem oficial do Playwright: já inclui o Chromium e todas as libs de sistema.
# Evita o problema de instalar dependências do browser via nixpacks/apt.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app
ENV NODE_ENV=production

# Instala dependências (com devDeps, necessárias para o build do Next).
COPY package*.json ./
RUN npm ci --include=dev

# Copia o resto e compila.
COPY . .
RUN npm run build

EXPOSE 3000

# Serviço web por omissão; o worker sobrepõe o Start Command para `npm run scan`.
CMD ["npm", "start"]
