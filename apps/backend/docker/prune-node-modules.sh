#!/bin/sh
# Élague les dépendances de PRODUCTION du serveur avant leur copie dans
# l'image (Dockerfile, étape « prod-deps ») : ne reste que ce que Node charge.
#
# Usage : prune-node-modules.sh <node_modules> [<node_modules>…]
#
# Prisma d'abord, qui pesait le plus : le client généré ne charge que
# `@prisma/client/runtime/library.js` et son moteur « library » — pas les
# compilateurs de requêtes des autres bases (postgres, sqlserver, sqlite,
# cockroach…), ni les variantes edge/wasm, ni la CLI et son moteur de schéma
# (le schéma se pose par le client, services/schemaInit).
set -eu

prune() {
  if [ -d @prisma/client/runtime ]; then
    find @prisma/client/runtime -type f ! -name 'library.js' -delete
  fi
  rm -rf @prisma/client/generator-build @prisma/client/scripts @prisma/engines prisma
  if [ -d .prisma/client ]; then
    find .prisma/client -maxdepth 1 -type f \
      ! -name 'index.js' ! -name 'default.js' ! -name 'package.json' \
      ! -name 'schema.prisma' ! -name 'libquery_engine-*' -delete
  fi

  # Rien de ce qui ne s'exécute pas : cartes de sources, types, sources
  # TypeScript publiées à côté du JavaScript, documentation, tests, exemples.
  find . -type f \( -name '*.map' -o -name '*.ts' -o -name '*.mts' -o -name '*.cts' \
    -o -name '*.md' -o -name '*.markdown' -o -iname 'CHANGELOG*' -o -iname 'HISTORY*' \
    -o -name '*.tsbuildinfo' -o -name '.npmignore' -o -name '.eslintrc*' -o -name '.prettierrc*' \
    -o -name '.editorconfig' -o -name 'tsconfig*.json' \) -delete
  find . -depth -type d \( -name test -o -name tests -o -name __tests__ -o -name docs \
    -o -name example -o -name examples -o -name .github -o -name benchmarks \) -exec rm -rf {} +
}

for dir in "$@"; do
  if [ -d "$dir" ]; then
    (cd "$dir" && prune)
  fi
done
