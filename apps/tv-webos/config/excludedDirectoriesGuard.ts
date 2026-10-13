import { normalizePath, type Plugin } from "vite";
import { formatRefusal } from "./postcss/compatMessage";

/**
 * La garde des dossiers que la feuille du téléviseur ne balaie pas.
 *
 * `EXCLUDED_WEB_DIRECTORIES` retire des dossiers du `content` de Tailwind :
 * leurs classes ne sont plus générées. C'est juste tant qu'aucun de leurs
 * modules n'est compilé — et faux, EN SILENCE, dès qu'un écran de la dalle en
 * importe un : il s'afficherait sans ses classes, sans rien dans la console
 * (l'avertissement d'en-tête de `tailwind.config.ts`). Ce greffon rend la faute
 * bruyante : un module d'un dossier exclu dans le graphe arrête le build.
 *
 * Il lit le graphe FINAL, en fin de construction : un module que la table de
 * substitution remplace n'y entre jamais, son remplaçant seul y figure. Comme
 * `inlineStyleGuard`, le périmètre est donc exact.
 */
export function excludedDirectoriesGuard(directories: readonly string[]): Plugin {
  return {
    name: "tentacle-garde-dossiers-exclus",
    apply: "build",

    buildEnd(error) {
      if (error) return;
      const inside = (id: string) => findExcludedModules([id], directories).length > 0;
      const intruders = [...this.getModuleIds()].filter(inside);
      if (intruders.length === 0) return;
      // La porte : ce qui, hors des dossiers exclus, en importe un module — c'est elle qu'on substitue.
      const doors = new Set(intruders.flatMap((id) => {
        const info = this.getModuleInfo(id);
        return [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])].filter((importer) => !inside(importer));
      }));
      this.error(formatRefusal(
        `${intruders.length} module(s) d'un dossier que la feuille du téléviseur ne balaie pas sont dans son graphe,` +
          ` entré(s) par ${[...doors].map(shorten).join(", ")} :`,
        intruders.map((id) => `  ${shorten(id)}`),
        [
          "Leurs classes Tailwind ne sont pas générées : ces écrans s'afficheraient",
          "sans elles sur la dalle. Soit substituer la porte qui les fait entrer",
          "(config/substitutionTable.ts), soit retirer leur dossier",
          "d'EXCLUDED_WEB_DIRECTORIES — la garde Chrome 53 jugera alors leurs classes.",
        ],
      ));
    },
  };
}

/**
 * Les modules rangés sous l'un des dossiers, comparés à slashs (`normalizePath`,
 * comme `substitutionModules`) et sans suffixe de requête (`?used`, `?original`).
 * Le séparateur final compte : `setupWizard` ne couvre pas `setupWizardOld`.
 */
export function findExcludedModules(moduleIds: Iterable<string>, directories: readonly string[]): string[] {
  const prefixes = directories.map((directory) => `${normalizePath(directory).replace(/\/+$/, "")}/`);
  const found: string[] = [];
  for (const id of moduleIds) {
    const path = normalizePath(id.split("?")[0]);
    if (prefixes.some((prefix) => path.startsWith(prefix))) found.push(path);
  }
  return found;
}

/** Un chemin court, relatif à la racine du dépôt. */
function shorten(id: string): string {
  const path = normalizePath(id.split("?")[0]);
  const brand = path.lastIndexOf("/apps/");
  return brand === -1 ? path : path.slice(brand + 1);
}
