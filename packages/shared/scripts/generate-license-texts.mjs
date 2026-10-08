// Porte les textes complets des licences dans un module TypeScript, que
// l'écran « Licences » de chaque plateforme charge hors ligne :
// `src/licenses/licenseTexts.generated.ts`.
//
// Sources, dans cet ordre :
//  - `src/licenses/texts/*.txt` : les textes officiels (gnu.org, mozilla.org,
//    apache.org, SPDX), un fichier par identifiant, rangés par nom de fichier ;
//  - `LICENSE-EXCEPTIONS` à la racine : les permissions de Tentacle TV ;
//  - `apps/tv/ios/Vendor/PrismCore/LICENSE` : PrismCore, embarqué sur l'Apple TV.
//
// Chaque texte est repris à l'octet près — `licenseCatalog.test.ts` le vérifie.
// Après avoir touché une de ces sources :
//   pnpm --filter @tentacle-tv/shared generate:licenses
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const textsDir = join(packageRoot, "src", "licenses", "texts");
const outputFile = join(packageRoot, "src", "licenses", "licenseTexts.generated.ts");

// Tri par NOM DE FICHIER, extension comprise : « BSD-3-Clause-Clear.txt »
// passe avant « BSD-3-Clause.txt » (le tiret précède le point).
const officialTexts = readdirSync(textsDir)
  .filter((file) => file.endsWith(".txt"))
  .sort()
  .map((file) => [file.slice(0, -".txt".length), join(textsDir, file)]);

const extraTexts = [
  ["Tentacle-TV-Exceptions", join(repoRoot, "LICENSE-EXCEPTIONS")],
  ["PrismCore", join(repoRoot, "apps", "tv", "ios", "Vendor", "PrismCore", "LICENSE")],
];

const entries = [...officialTexts, ...extraTexts].map(
  ([id, path]) => `  ${JSON.stringify(id)}: ${JSON.stringify(readFileSync(path, "utf8"))},\n`,
);

const output =
  "// Généré par packages/shared/scripts/generate-license-texts.mjs depuis\n" +
  "// src/licenses/texts/*.txt (textes officiels) — ne pas retoucher à la main.\n" +
  "export const LICENSE_TEXTS = {\n" +
  entries.join("") +
  "} as const;\n" +
  "\n" +
  "export type LicenseTextId = keyof typeof LICENSE_TEXTS;\n";

writeFileSync(outputFile, output);
console.log(`${entries.length} textes → ${outputFile}`);
