/**
 * La commande `tentacle` : le MÊME exe que l'hôte, lancé par l'alias
 * d'exécution du paquet (`tentacle.exe`). Le manifeste ajoute `--cli` à ses
 * paramètres (`msix/Package.appxmanifest`) ; à défaut — un alias qui ne
 * porterait pas les paramètres de son extension —, le nom tapé suffit :
 * `process.argv0` vaut alors `tentacle` ou `…\tentacle.exe`.
 *
 * En mode ligne de commande, l'hôte ne prend ni l'instance unique, ni
 * l'icône : il lance `apps/backend/dist/cli/tentacle.js` avec le même
 * environnement que le serveur (mêmes données, même port) et rend son code.
 */
import { basename } from "node:path";

/** Le marqueur que le manifeste pose après `--` pour l'alias. */
export const CLI_MARKER = "--cli";

/** Le nom de l'alias d'exécution (`desktop:ExecutionAlias`). */
export const CLI_ALIAS = "tentacle.exe";

export function isCliInvocation(argv: readonly string[], argv0: string): boolean {
  if (argv.slice(1).includes(CLI_MARKER)) return true;
  const name = basename(argv0.replace(/\\/g, "/")).toLowerCase();
  return name === "tentacle" || name === CLI_ALIAS;
}

/** Les arguments de la commande : après le marqueur, sans les options de l'hôte. */
export function cliArguments(argv: readonly string[]): string[] {
  const rest = argv.slice(1);
  const marker = rest.indexOf(CLI_MARKER);
  const args = marker >= 0 ? rest.slice(marker + 1) : rest;
  const kept: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--app-root") {
      i++;
      continue;
    }
    const arg = args[i];
    if (arg !== undefined) kept.push(arg);
  }
  return kept;
}
