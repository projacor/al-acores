#!/bin/zsh
# Wrapper para o launchd correr o scan diário no Mac (IP residencial).
# O launchd não carrega o teu perfil da shell, por isso definimos o PATH à mão.

export PATH="/Users/pfragoso/.nvm/versions/node/v20.20.2/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/pfragoso/Downloads/teste/al-acores || exit 1

echo "===== scan iniciado: $(date) ====="
npm run scan
echo "===== scan terminado: $(date) (exit $?) ====="
