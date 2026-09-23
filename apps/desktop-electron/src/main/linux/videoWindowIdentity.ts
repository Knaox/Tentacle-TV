/**
 * L'IDENTITÉ de la fenêtre vidéo collée — ce qu'Alt+Tab en montre.
 *
 * Pendant la lecture, c'est la fenêtre mpv qui représente l'application dans
 * le sélecteur de KWin : sa vignette est la seule qui contienne l'image (voir
 * `kwinGlueTemplate.ts`). Encore faut-il qu'elle y porte NOTRE nom et NOTRE
 * icône, et non « fichier.mkv - mpv » sous le logo de mpv.
 *
 * # Le titre
 *
 * mpv écrit son option `title` dans le titre de sa fenêtre Wayland : on lui
 * donne celui de notre fenêtre. Il sert aussi de signal à la colle — un titre
 * VIDE veut dire « garée » (`ipc/videoLifecycle.ts`), et l'hôte reprend alors
 * sa place dans Alt+Tab.
 *
 * # L'icône, par un app-id qui est un CHEMIN
 *
 * KWin tire l'icône d'une fenêtre Wayland du `.desktop` que désigne son app-id
 * (`XdgToplevelWindow::updateIcon`, mpv ne pose aucune icône lui-même). Et
 * `Window::findDesktopFile` accepte un chemin ABSOLU : un app-id
 * `/…/tentacle-tv-video` fait lire `/…/tentacle-tv-video.desktop` (sources de
 * KWin 6.7). On écrit donc ce fichier dans NOTRE dossier de données — rien
 * dans `~/.local/share/applications`, aucun menu ne le voit — avec l'icône
 * par chemin absolu, que `QIcon::fromTheme` charge telle quelle (Qt 6).
 *
 * Cet app-id est aussi la classe par laquelle la colle reconnaît la fenêtre
 * vidéo. Si l'écriture échoue, mpv garde son app-id « mpv », que la colle
 * reconnaît toujours : on perd l'icône, jamais la colle.
 */

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Le nom de base du `.desktop` et de son icône. */
const BASENAME = "tentacle-tv-video";

/** Le titre de repli, si la fenêtre hôte n'en a pas (encore) — celui de la page. */
const FALLBACK_TITLE = "Tentacle TV";

/** `undefined` : pas encore préparée ; `null` : l'écriture a échoué. */
let prepared: string | null | undefined;

/** Une valeur de `.desktop` : les barres obliques inverses s'y échappent. */
function desktopValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", " ");
}

/**
 * Le `.desktop` de la fenêtre vidéo. `NoDisplay` par principe : il ne vit dans
 * aucun dossier d'applications, mais il ne doit rien prétendre lancer.
 */
export function desktopEntry(iconPath: string | null): string {
  const lines = ["[Desktop Entry]", "Type=Application", `Name=${FALLBACK_TITLE}`, "NoDisplay=true"];
  if (iconPath !== null) lines.push(`Icon=${desktopValue(iconPath)}`);
  return `${lines.join("\n")}\n`;
}

/**
 * Le titre donné à mpv : celui de notre fenêtre. mpv DÉVELOPPE `${…}` dans son
 * option `title` — un `$` du titre s'y double pour rester un `$`.
 */
export function mpvWindowTitle(hostTitle: string): string {
  const title = hostTitle.trim() === "" ? FALLBACK_TITLE : hostTitle.trim();
  // Par fonction : en chaîne de remplacement, « $$ » vaut UN seul « $ ».
  return title.replaceAll("$", () => "$$");
}

/**
 * Prépare l'identité une fois par processus : le `.desktop` et une copie de
 * l'icône dans `folder`. Rend l'app-id à donner à mpv, ou `null` — mpv garde
 * alors le sien.
 */
export function prepareVideoWindowIdentity(folder: string, iconSource: string | null): string | null {
  if (prepared !== undefined) return prepared;
  try {
    mkdirSync(folder, { recursive: true });
    let icon: string | null = null;
    if (iconSource !== null) {
      icon = path.join(folder, `${BASENAME}.png`);
      copyFileSync(iconSource, icon);
    }
    writeFileSync(path.join(folder, `${BASENAME}.desktop`), desktopEntry(icon), "utf8");
    prepared = path.join(folder, BASENAME);
  } catch (error) {
    console.warn(`[video] identité de la fenêtre vidéo non écrite — ${String(error)}`);
    prepared = null;
  }
  return prepared;
}

/** L'app-id de la fenêtre vidéo, une fois préparé ; `null` sinon. */
export function videoWindowAppId(): string | null {
  return prepared ?? null;
}

/** Les tests repartent à zéro. */
export function forgetVideoWindowIdentity(): void {
  prepared = undefined;
}
