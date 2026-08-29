import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Le nom de l'exécutable de l'app TAURI, celui qu'on doit continuer d'honorer.
 * Il vient du `name` de son Cargo.toml — relevé sur les paquets réellement
 * publiés en 1.17.0, pas déduit.
 */
const LEGACY_EXECUTABLE_NAME = "tentacle-desktop";

/**
 * L'héritage de l'app Tauri : deux fichiers, pour que la mise à jour aboutisse.
 *
 * Les paquets Tauri (≤ 1.17.0) portaient le MÊME nom de paquet que ceux-ci —
 * `tentacle-tv`, vérifié sur les paquets publiés. apt, dnf et pacman font donc
 * une vraie mise à jour. Mais le binaire y vivait en `/usr/bin/tentacle-desktop`
 * et l'entrée de bureau s'appelait « Tentacle TV.desktop », alors qu'Electron
 * installe `/opt/tentacle-tv/tentacle-tv` et `tentacle-tv.desktop`. Deux choses
 * cassent sans ces fichiers :
 *
 *  1. **le redémarrage après mise à jour** — l'app Tauri relance son propre
 *     exécutable (`current_exe()`, donc `/usr/bin/tentacle-desktop`) une fois
 *     l'installation faite. Chemin disparu : elle se ferme et ne revient pas,
 *     et l'utilisateur croit la mise à jour ratée ;
 *  2. **le lanceur épinglé** — il désigne une entrée de bureau qui n'existe plus.
 *
 * Ce sont des FICHIERS DU PAQUET, pas un script d'installation : c'est ce qui
 * garantit qu'ils remplacent proprement ceux de l'ancien paquet (les trois
 * gestionnaires savent faire), qu'ils partent à la désinstallation, et qu'on ne
 * touche pas aux scripts d'electron-builder — lesquels posent le SUID de
 * `chrome-sandbox` et le profil AppArmor.
 *
 * Un script d'enveloppe plutôt qu'un lien symbolique : fpm recopie les arbres
 * sources, et un lien y est une dépendance de plus à son comportement.
 */
export function prepareLegacyCompat(output, PRODUCT_NAME, EXECUTABLE_NAME) {
  const folder = path.join(output, "compat");
  rmSync(folder, { recursive: true, force: true });
  const target = `/opt/${EXECUTABLE_NAME}/${EXECUTABLE_NAME}`;

  const binary = path.join(folder, "usr/bin", LEGACY_EXECUTABLE_NAME);
  mkdirSync(path.dirname(binary), { recursive: true });
  writeFileSync(
    binary,
    `#!/bin/sh\n# Compatibilité : l'application Tauri s'installait ici (voir package-linux.mjs).\nexec ${target} "$@"\n`,
  );
  chmodSync(binary, 0o755);

  const entry = path.join(folder, "usr/share/applications", `${PRODUCT_NAME}.desktop`);
  mkdirSync(path.dirname(entry), { recursive: true });
  // `NoDisplay` : le menu des applications montre déjà la vraie entrée. Celle-ci
  // n'existe que pour les lanceurs épinglés, qui la désignent par son nom.
  writeFileSync(
    entry,
    [
      "[Desktop Entry]",
      `Name=${PRODUCT_NAME}`,
      `Exec=${EXECUTABLE_NAME} %U`,
      `Icon=${EXECUTABLE_NAME}`,
      `StartupWMClass=${EXECUTABLE_NAME}`,
      "Type=Application",
      "Categories=AudioVideo;Video;Player;",
      "Terminal=false",
      "NoDisplay=true",
      "",
    ].join("\n"),
  );

  // fpm prend les arbres sources en argument positionnel : `<source>/=<cible>`.
  // Ils sont poussés par electron-builder JUSTE AVANT les siens.
  return [`${folder}/=/`];
}
