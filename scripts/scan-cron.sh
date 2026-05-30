#!/bin/zsh
# Wrapper para o launchd correr a pesquisa SEMANAL no Mac (IP residencial).
# O launchd não carrega o teu perfil da shell, por isso definimos o PATH à mão.
# Corre o Booking e o FB Marketplace na mesma corrida (1×/semana → poupa Apify).

export PATH="/Users/pfragoso/.nvm/versions/node/v20.20.2/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/pfragoso/al-acores || exit 1

echo "===== corrida semanal iniciada: $(date) ====="

echo "--- Booking ---"
npm run scan
echo "--- Booking terminado (exit $?) ---"

echo "--- Facebook Marketplace ---"
npm run fb
echo "--- FB terminado (exit $?) ---"

echo "--- Airbnb (ZenRows) ---"
npm run airbnb
echo "--- Airbnb terminado (exit $?) ---"

echo "===== corrida semanal terminada: $(date) ====="
