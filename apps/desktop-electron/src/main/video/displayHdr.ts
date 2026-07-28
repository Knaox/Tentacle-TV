/**
 * L'état HDR de l'écran, vu depuis la session de lecture.
 *
 * # Deux systèmes, deux modèles — et c'est le fond du sujet
 *
 * **Windows** possède un interrupteur : l'écran est en HDR ou il ne l'est pas,
 * pour TOUT le bureau. On le bascule à l'entrée du lecteur et on le rend en
 * sortant, sinon le reste du système paraît délavé (voir `hdr.ts`).
 *
 * **macOS n'a pas cet interrupteur, et n'en a pas besoin.** L'EDR est alloué par
 * le compositeur, fenêtre par fenêtre, à celle qui déclare en avoir l'usage : le
 * contenu SDR affiché à côté n'est jamais remappé. Il n'y a donc rien à
 * basculer, rien à rendre, et surtout rien à restaurer si l'application meurt
 * brutalement — le défaut que `hdr.ts` passe l'essentiel de son code à éviter.
 *
 * Ce module donne aux deux systèmes le même vocabulaire, pour que
 * `hdrSession.ts` n'ait pas à choisir son camp.
 *
 * ⚠️ Chargement PARESSEUX de `hdr.ts` : il appelle `koffi.load("user32.dll")` à
 * l'import et ferait tomber le processus principal sur macOS.
 */

/** L'écran est-il en HDR ? Sur macOS : l'EDR est-il à notre disposition ? */
export function hdrActif(): boolean {
  if (process.platform !== "win32") return false;
  return (require("./hdr") as typeof import("./hdr")).hdrActif();
}

/**
 * Un écran sait-il faire du HDR ?
 *
 * Sert à n'offrir la préférence de bascule que là où elle change quelque chose.
 * Sur macOS elle ne change JAMAIS rien — il n'y a pas de bascule à autoriser —
 * d'où le `false` franc : l'option disparaît de l'interface au lieu de promettre
 * un effet qui n'arrivera pas.
 */
export function hdrSupporte(): boolean {
  if (process.platform !== "win32") return false;
  return (require("./hdr") as typeof import("./hdr")).hdrSupporte();
}

/** Avons-nous basculé l'écran nous-mêmes ? Jamais, hors Windows. */
export function basculeEnCours(): boolean {
  if (process.platform !== "win32") return false;
  return (require("./hdr") as typeof import("./hdr")).basculeEnCours();
}

/** Bascule l'écran en HDR. Sans objet hors Windows : rien à basculer. */
export function activerHdr(): boolean {
  if (process.platform !== "win32") return false;
  return (require("./hdr") as typeof import("./hdr")).activerHdr();
}

/** Rend les écrans à leur état d'origine. Sans objet hors Windows. */
export function restaurerHdr(): void {
  if (process.platform !== "win32") return;
  (require("./hdr") as typeof import("./hdr")).restaurerHdr();
}
