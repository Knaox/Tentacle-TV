# Dépendances mortes de Tentacle-TV et du proto CEF — inventaire (axe `inventaire`, 04/11/2026)

Base : Tentacle-TV `dev` = `7434d90f` (release desktop 1.42.0), copiée par `git archive dev` dans
`~/.cache/tentacle-cef/inventaire/` (`tv-dev/` pour l'analyse, `patch-base/` — dépôt git à part —
pour les correctifs). **Rien n'a été écrit dans Tentacle-TV.** Correctifs prêts, jamais appliqués :
`docs/patches/inventaire-deps-*.patch`.

## 1. Méthode (sans installer d'outil, sans réseau)

- `knip`/`depcheck` **non utilisés** (pas d'installation d'outil npm, donc pas de question au
  coordinateur). À la place, un scanner maison (Node, hors dépôt) : pour chacune des **240**
  dépendances déclarées des 17 paquets, les fichiers qui l'importent (`from`, `import()`,
  `require`, `require.resolve`, `vi.mock`) et ceux qui la nomment (configs Babel/Metro/PostCSS/
  Gradle/app.json, scripts `package.json`) ; puis, pour chaque candidat, les pairs qui la réclament
  dans `pnpm-lock.yaml`, une recherche `rg --hidden` sur tout le dépôt (`.github/` compris) et la
  lecture des configs. Les 58 « sans import » sont presque tous des outils (`typescript`→`tsc`,
  `cross-env`, `tsx`, `esbuild`, `@types/node`) ou des modules lus par une config.
- Installation **hors ligne** (`pnpm install --offline --frozen-lockfile --ignore-scripts`, magasin
  pnpm local de 6,1 Go) dans la copie, pour typer et construire le web. Aucun script d'installation
  exécuté, aucune résolution nouvelle : `minimumReleaseAge` (7 jours), `onlyBuiltDependencies` et
  `pnpm.overrides` ne sont pas sollicités. Les lockfiles des correctifs sont régénérés par
  `pnpm install --lockfile-only --offline --ignore-scripts` : **uniquement des lignes retirées**,
  aucune version ajoutée ni changée (vérifié par `git diff` dans `patch-base`).
- Extensions : `apps/backend/scripts/build-shared-deps.js` expose aux greffons
  `window.__SHARED_DEPS__ = { React, JSXRuntime, ReactDOMClient, TQ, RI, i18next }`. D'où les
  `react`, `react-dom`, `@tanstack/react-query`, `react-i18next`, `i18next`, `esbuild` en
  devDependencies du **backend** : vivants, à ne jamais retirer. Aucun retrait proposé ne les touche.
- « Depuis février » : le dépôt commence le 24/02/2026 (`c299cf933`) ; l'historique des
  `package.json` a été relu en entier (`git log -p`), plus le diff des listes de dépendances.

## 2. Retraits prouvés (correctifs prêts)

| Paquet | Retrait | Preuve | Correctif |
|---|---|---|---|
| `apps/tv` | `react-native-webview` 13.15.0 (+ son bloc `react-native.config.js`, son entrée de singleton Metro) | **Remplacé le 05/10** par `react-native-video` (`3f2c29a37`, « Android TV quitte l'embed YouTube de la WebView ») : dernier `import { WebView }` retiré ce jour-là. Aujourd'hui : 0 import dans `apps/tv` et `packages/` ; aucune mention native (`android/`, Podfile) ; aucun pair ne la réclame côté TV (seul `expo`, au mobile, qui garde la sienne) ; `metro.config.js` ignore déjà un singleton absent (`try/catch`). Gain : un module natif Android de moins à autolier/compiler dans l'APK TV. | `docs/patches/inventaire-deps-tv.patch` (3 fichiers + lockfile −10 lignes) |
| `packages/ui` | `react-dom` (devDependency **et** peerDependency), `@types/react-dom` | 0 import dans `packages/ui/src` ; sa seule dépendance, `framer-motion` 11.18.2, n'importe jamais `react-dom` (dist ES/CJS et `.d.ts` relus) et le déclare en pair **facultatif** ; `tsc --noEmit` de `ui` **vert avec `react-dom` et `@types/react-dom` retirés de `node_modules`** (copie), puis remis. Les consommateurs (`apps/web`, `apps/tv-webos`) déclarent les leurs. | `docs/patches/inventaire-deps-ui.patch` (package.json + lockfile −6 lignes) |

Les deux correctifs et celui du front (`inventaire-front-greffons-cef.patch`, voir
`PARITE-ELECTRON.md` § 4) s'appliquent ensemble sur `dev` (`git apply --check`), et une nouvelle
passe `pnpm install --lockfile-only --offline` ne change plus rien. Appliquer :
`git apply docs/patches/inventaire-deps-<paquet>.patch` dans Tentacle-TV, puis `pnpm install`
(le `--frozen-lockfile` de la CI passe : lockfile et manifestes concordent).

⚠️ Avertissement vu en régénérant (préexistant, sans lien avec ces retraits — pnpm le dit dès qu'il
résout tout l'espace) : `apps/tv › react-dom 19.2.4 › unmet peer react@^19.2.4: found 19.1.0`.

## 3. Ce qui pèse dans le bundle web chargé par CEF

Build de production du web (`vite build`, config du dépôt + un relevé des octets par module, copie
seulement) : **296 fichiers, 7,7 Mo** sous `assets/`. Au démarrage, la page charge 4 morceaux JS
(**3,46 Mo minifiés**, dont `index-*.js` 3,07 Mo / 931 Ko gzip) + 297 Ko de CSS. Par différence
(dépendance remplacée par un vide, même build) :

| Au démarrage, inutile sous CEF | Minifié | gzip | Pourquoi il est là | Gain possible |
|---|---|---|---|---|
| **`hls.js` 1.7.3** | **598 Ko** (−19,5 % du morceau) | 186 Ko | import statique : `App.tsx` → `PluginIframe.tsx` → `trailerPlayer/index.ts` → `TrailerStage.tsx` → `useTrailerHls.ts` → `hooks/hlsErrorRecovery.ts` (`import Hls`). CEF et Electron lisent par mpv ; hls.js ne sert qu'au lecteur web de repli et aux bandes-annonces | charger `hlsErrorRecovery` / le lecteur de bande-annonce à la demande (`import()`, comme `trailerPreview/previewSource.ts` le fait déjà) |
| **Une des deux langues** (`packages/shared/src/i18n/locales/{fr,en}`, 92 fichiers chacune) | **423 Ko** (l'anglais) | 129 Ko | `shared/src/i18n/index.ts` importe `fr` ET `en` statiquement | ne charger que la langue détectée, l'autre à la bascule |
| Écran des nouveautés (`apps/web/src/whatsNew/`) | ≈ 386 Ko rendus (avant minification) | — | importé dès `main.tsx` | à la demande, quand il y a quelque chose à montrer |
| Watch Together (`apps/web/src/watchTogether/`) | ≈ 113 Ko rendus | — | idem | à la demande |

Le reste du démarrage est le cœur de l'app : `react-dom` (540 Ko rendus), `react-router` (444 Ko ;
son dossier `development/` est identique octet pour octet à `production/` en 7.18.4 — pas de piège),
`framer-motion` (360 Ko), `@tanstack/query-core`, `i18next`. Déjà à la demande : `country-flag-icons`
(179 Ko, admin), `libpgs` (61 Ko), `@tanstack/virtual-core`, `uqr`.

Ce ne sont **pas des dépendances mortes** (toutes servent sur le web) mais du code chargé et
compilé par V8 dans le processus de rendu de CEF sans y servir : ≈ **1,4 Mo minifiés** pour hls.js
et une langue seuls. L'effet en RAM n'est **pas mesuré** (à faire par l'axe `ram` : `heapUsed` et
empreinte du rendu avant/après, même build). Pas de correctif fourni : ce sont des changements de
code du front, à décider par le coordinateur (le gain vaut aussi pour Electron et le web).

## 4. Candidats examinés et gardés (non morts)

| Paquet | Dépendance | Pourquoi elle reste |
|---|---|---|
| `apps/web`, `apps/tv-webos` | `autoprefixer`, `postcss` | `postcss.config.js` (clé sans guillemets) ; pair de `tailwindcss` |
| `apps/tv-webos` | `terser` | pair de `@vitejs/plugin-legacy` et de `vite` (`^5.16.0`) |
| `apps/mobile` | `expo-linking`, `@expo/metro-runtime` | pairs d'`expo-router` 6.0.24 |
| `apps/mobile` | `react-dom` | pair d'`@expo/metro-runtime` ; nommé par `metro.config.js` (singleton) |
| `apps/mobile` | `expo-font`, `expo-screen-orientation` | plugins d'`app.json` (+ pair d'`@expo/vector-icons` pour expo-font) |
| `apps/mobile` | `expo-splash-screen` | aucun import ni pair, mais module natif autolié qui porte l'écran de lancement d'Expo 54 : retrait **non prouvable sans un build natif** → gardé |
| `apps/mobile`, `apps/tv` | `@babel/runtime` | assistants de `babel-preset-expo` / `@shopify/flash-list` |
| `apps/mobile` | `babel-plugin-module-resolver` | `babel.config.js` (`"module-resolver"`) |
| `apps/mobile`, `apps/tv` | `react-native-css-interop` | NativeWind ; singleton Metro |
| `apps/tv` | `@react-native-community/cli*`, `@react-native/babel-preset`, `@react-native/gradle-plugin` | CLI RN, `babel.config.js` (`module:@react-native/babel-preset`), `android/settings.gradle` |
| `apps/desktop-electron` | `@tentacle-tv/web`, `esbuild`, `cross-env` | scripts `build:web`, `build:preload` |
| `apps/port-check` | `esbuild`, `tsx` | scripts |
| tous | `typescript`, `@types/node`, `vitest` | `tsc`, tests |

## 5. Doublons de versions (dépendances directes)

| Dépendance | Versions | Avis |
|---|---|---|
| **`@tanstack/react-query`** | **4.44.0** (`apps/tv`) contre 5.90.21 (web, mobile, `api-client`, `plugins-api`, backend) | ⚠️ **à risque** : `apps/tv/metro.config.js` force `@tanstack/react-query` en singleton depuis l'app TV, donc le code de `api-client` (écrit pour la v5) tourne sur la v4 dans l'APK. Déclaré en v4 depuis le 27/02 (`f70c7b07c`). À trancher par le propriétaire de la TV ; hors périmètre ici |
| `esbuild` | 0.25.12 (`desktop-electron`) contre 0.28.2 (backend, port-check, server-windows) | sans gain : `vite` 6.4.4 tire de toute façon `esbuild ^0.25` |
| `react` / `react-dom` | 19.1.0 (mobile, tv : épinglé par React Native) contre 19.2.4 | voulu |
| `react-native-svg`, `-video`, `-css-interop`, `react-native` | mobile (RN 0.81) contre tv (react-native-tvos 0.80) | voulu (deux moteurs RN) |
| `@types/react` dans `packages/tv-core` | déclaré `^18.3.0`, résolu 19.2.14 par `pnpm.overrides` | cosmétique : écrire `^19.0.0` lèverait l'ambiguïté |

## 6. Proto CEF : `web/shim/` et `tools/`

- **Aucune dépendance npm** : ni `package.json`, ni lockfile. Tous les scripts (`web/shim/*.mjs`,
  `web/shim/dev/*.mjs`, `tools/cdp-eval.mjs`) n'importent que `node:*` et le `WebSocket` natif de
  Node ≥ 22 (Node 24.22 ici). Rien à retirer.
- Dépendances hors npm, à connaître : Google Chrome (`web/shim/dev/run-chrome.mjs`, banc du shim
  sans le socle, `PONT_CHROME`) ; `python3`, `curl`, `jq`, `ffmpeg`/`ffprobe`, `x265`, `dovi_tool`,
  `mkvmerge`, `colima`/`docker` (bancs et médias de test).
- Doublon : deux `cdp-eval.mjs` — `tools/cdp-eval.mjs` (socle, 20 l.) et `web/shim/dev/cdp-eval.mjs`
  (pont, 12 l., sur `cdp.mjs`). Tous deux cités par la doc et les scripts : unifier est un choix de
  leurs propriétaires, pas un retrait.
- `tools/edr-probe/CMakeLists.txt` : le témoin `edr-probe` ne demande qu'AppKit, mais le même projet
  exige `SDL3`, libmpv et **`find_package(Vulkan REQUIRED)`** pour `edr-calib`/`edr-calib-vk` :
  sans SDK Vulkan, le témoin lui-même ne se configure pas. Proposition au propriétaire (`recette`) :
  rendre les deux étalonneurs facultatifs (`option()` ou `find_package` sans `REQUIRED`).
- `web/shim/dev/edr-trace.sh`, `pass-cef.sh` : points d'entrée lancés à la main (non référencés,
  normal). Le reste du proto (CMake, `scripts/deps/`) relève de l'axe `paquet`.
