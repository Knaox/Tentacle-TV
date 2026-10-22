import { chmodSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Rend le dossier assemblé lisible et traversable par TOUS, avant qu'il parte
 * dans un paquet.
 *
 * ⚠️ `@electron/packager` 20 assemble l'application dans un dossier né de
 * `mkdtemp` — donc en 0700 — puis le RENOMME en `tentacle-tv-linux-x64`. Le
 * mode survit au renommage, et fpm recopie les modes tels quels : le `.deb` et
 * le paquet Arch installaient `/opt/tentacle-tv` en `drwx------ root`. Seul
 * root pouvait lancer l'application ; un utilisateur recevait « Permission
 * denied » sur `/usr/bin/tentacle-tv`. Mesuré sur le `.deb` 1.31.1 publié et
 * à l'installation dans des conteneurs Ubuntu, Debian et Arch (recette du
 * 2026-10-22). Le `.rpm` y échappait : rpm ne possède pas le dossier et le crée
 * en 0755.
 *
 * On ne pose pas un mode fixe sur tout l'arbre : `chrome-sandbox`, les
 * exécutables et les bibliothèques gardent leurs bits d'exécution. On AJOUTE
 * seulement ce que `chmod a+rX` ajouterait : lecture pour tous, traversée
 * des dossiers, exécution de ce qui était déjà exécutable.
 *
 * Rend la liste des chemins corrigés (relatifs au dossier), pour le journal.
 */
export function openBundlePermissions(folder) {
  const fixed = [];
  const visit = (current) => {
    const stats = statSync(current);
    const mode = stats.mode & 0o7777;
    const isDirectory = stats.isDirectory();
    // `chmod a+rX` : la traversée aux dossiers, l'exécution à ce que son
    // propriétaire peut déjà exécuter.
    const wanted = mode | 0o444 | (isDirectory || (mode & 0o100) !== 0 ? 0o111 : 0);
    if (wanted !== mode) {
      chmodSync(current, wanted);
      fixed.push(path.relative(folder, current) || ".");
    }
    if (!isDirectory) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      // Un lien ne porte pas de mode à lui : on ne le suit pas.
      if (entry.isSymbolicLink()) continue;
      visit(path.join(current, entry.name));
    }
  };
  visit(folder);
  return fixed;
}
