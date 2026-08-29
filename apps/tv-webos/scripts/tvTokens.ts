/**
 * Engendre `client/src/styles/tokens-tv.css` depuis `@tentacle-tv/theme`.
 *
 * La feuille était écrite à la main, et ses valeurs n'existaient nulle part
 * ailleurs : invisibles depuis le JavaScript, donc impossibles à partager avec
 * Apple TV et Android TV. Elles vivent désormais dans `packages/theme`
 * (`tokens/tv.ts` et `tokens/tvOnly.ts`), avec les commentaires qui les
 * expliquent, et ce script en dérive la feuille.
 *
 * Changer une valeur : l'éditer dans `packages/theme`, relancer ce script. Les
 * trois cibles suivent — la LG par cette feuille, les deux autres en lisant les
 * mêmes données converties en nombres.
 *
 *   pnpm --filter @tentacle-tv/tv-webos tokens
 *
 * `packages/theme/src/tokens/tv.test.ts` compare en permanence la feuille aux
 * données : si quelqu'un édite l'une sans l'autre, la suite de tests le dit.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { partialThemeToCssVarEntries } from "@tentacle-tv/theme/css";
import {
  TV_THEME_TOKEN_OVERRIDES,
  TV_THEME_TOKEN_OVERRIDES_LIGHT,
  tvOnlyCssVarEntries,
} from "@tentacle-tv/theme";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../client/src/styles/tokens-tv.css");

const block = (selector, entries) =>
  `${selector} {\n${entries.map(([n, v]) => `  ${n}: ${v};`).join("\n")}\n}`;

const sheet = [
  "/* Jetons du téléviseur — ce que la distance de lecture change.",
  " *",
  " * FICHIER ENGENDRÉ — ne pas éditer à la main.",
  " * Source : packages/theme/src/tokens/tv.ts et tvOnly.ts, où vivent aussi",
  " * les commentaires qui justifient chaque valeur.",
  " * Régénérer : pnpm --filter @tentacle-tv/tv-webos tokens",
  " *",
  " * Posés APRÈS `index.css`, donc après `theme/tokens.css` : mêmes noms,",
  " * mêmes rôles, valeurs adaptées. Rien n'est ajouté au vocabulaire du thème,",
  " * ce qui garde intact le contrat vérifié par `cssVars.test.ts`.",
  " *",
  " * Le thème du serveur peut encore surcharger ces valeurs à l'exécution — le",
  " * fournisseur écrit ses variables sur `:root` en style en ligne, qui l'emporte",
  " * sur toute feuille. C'est voulu : un téléviseur doit suivre le thème choisi",
  " * par l'utilisateur, il n'a pas à en imposer un autre. */",
  "",
  block(":root", [
    ...partialThemeToCssVarEntries(TV_THEME_TOKEN_OVERRIDES),
    ...tvOnlyCssVarEntries(),
  ]),
  "",
  "/* Le thème clair reste possible — certains préfèrent une dalle moins sombre",
  " * en plein jour — mais ses surfaces doivent être opaques pour les mêmes",
  " * raisons. */",
  block(
    ':root[data-theme="light"]',
    partialThemeToCssVarEntries(TV_THEME_TOKEN_OVERRIDES_LIGHT),
  ),
  "",
].join("\n");

writeFileSync(TARGET, sheet, "utf8");
console.log(`tokens-tv.css engendré (${sheet.split("\n").length} lignes)`);
