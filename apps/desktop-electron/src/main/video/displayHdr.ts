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
 * **Linux (Wayland)** se range du côté de macOS : le compositeur alloue l'espace
 * colorimétrique surface par surface, il n'y a rien à basculer. Sous X11 il n'y
 * a rien du tout — X.Org n'a pas de gestion de couleur et n'en aura pas.
 *
 * Ce module donne aux trois systèmes le même vocabulaire, pour que
 * `hdrSession.ts` n'ait pas à choisir son camp.
 *
 * ⚠️ Chargement PARESSEUX de `hdr.ts` : il appelle `koffi.load("user32.dll")` à
 * l'import et ferait tomber le processus principal sur macOS.
 */

/**
 * L'écran est-il en HDR ?
 *
 * Sur macOS la question n'a de sens que posée à l'écran qui PORTE la vidéo, et
 * la réponse n'est pas « l'écran est en mode HDR » — ce mode n'existe pas — mais
 * « la plage étendue est-elle accordée en ce moment ». C'est la seule mesure qui
 * distingue demander d'obtenir, et c'est ce que le panneau de diagnostic doit
 * montrer. Voir `macosEdr.ts`.
 *
 * `fenetreVideo` est la NSWindow de mpv, quand elle existe : sur un poste à
 * plusieurs moniteurs, c'est l'écran qui l'affiche qui compte, pas le principal.
 */
export function hdrActif(fenetreVideo?: unknown): boolean {
  if (process.platform === "win32") {
    return (require("./hdr") as typeof import("./hdr")).hdrActif();
  }
  // Sous Linux la question ne se pose pas à l'écran mais au RENDU : c'est
  // `video-target-params` qui dit ce qui sort, et lui seul. Voir `linux/hdr.ts`.
  if (process.platform === "linux") {
    return (require("../linux/hdr") as typeof import("../linux/hdr")).sortieHdr() === true;
  }
  if (process.platform !== "darwin") return false;
  const { lireEdr } = require("./macosEdr") as typeof import("./macosEdr");
  return lireEdr(fenetreVideo ?? null).obtenue;
}

/**
 * L'écran sait-il faire de la plage étendue ? macOS seulement.
 *
 * ⚠️ À ne PAS confondre avec `hdrSupporte`, qui commande l'affichage de la
 * préférence de bascule et doit rester faux ici : il n'y a rien à basculer sur
 * macOS. Celle-ci ne sert qu'au diagnostic.
 */
export function edrCapable(fenetreVideo?: unknown): boolean {
  if (process.platform !== "darwin") return false;
  const { lireEdr } = require("./macosEdr") as typeof import("./macosEdr");
  return lireEdr(fenetreVideo ?? null).capable;
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

/**
 * Ce que le RENDU dit de lui-même — pas ce que l'écran promet.
 *
 * macOS lit le journal de la couche Metal, Linux la propriété
 * `video-target-params`. Les deux répondent à la même question : l'image sort-
 * elle vraiment en plage étendue ? `null` = on ne sait pas, et surtout pas
 * « non ».
 *
 * ⚠️ À NE PAS confondre avec `hdrActif` sur macOS, qui est instantané et dépend
 * de la SCÈNE — une scène de nuit retombe à 1,00 sur une lecture parfaitement
 * HDR. Celui-ci ne dépend pas de l'image.
 */
export function renduEnHdr(): boolean | null {
  if (process.platform === "darwin") {
    return (require("./coucheMetal") as typeof import("./coucheMetal")).coucheEnHdr();
  }
  if (process.platform === "linux") {
    return (require("../linux/hdr") as typeof import("../linux/hdr")).sortieHdr();
  }
  return null;
}

/** L'espace de sortie en une ligne lisible, pour le panneau de diagnostic. */
export function espaceRendu(): string | null {
  if (process.platform === "darwin") {
    return (require("./coucheMetal") as typeof import("./coucheMetal")).espaceCouche();
  }
  if (process.platform === "linux") {
    return (require("../linux/hdr") as typeof import("../linux/hdr")).espaceSortie();
  }
  return null;
}

/**
 * Le film est-il TRANSMIS en HDR, ou tone-mappé ? Linux seulement — c'est le
 * verdict du COUPLE `video-params`/`video-target-params` (`linux/hdr.ts`), en
 * booléen : le panneau le lisait en cherchant « TONE-MAPPÉ » dans la chaîne
 * lisible, ce qui casse au premier changement de formulation.
 *
 * `null` = la question ne se pose pas (rien relevé, contenu SDR, autre
 * plateforme — macOS a `renduEnHdr`, qui répond autrement à autre chose).
 */
export function transmissionRendu(): boolean | null {
  if (process.platform !== "linux") return null;
  return (require("../linux/hdr") as typeof import("../linux/hdr")).transmissionHdr();
}

/**
 * La plage accordée par le compositeur, en multiples du blanc SDR — l'équivalent
 * Linux du headroom EDR de macOS. `null` hors Linux ou hors lecture.
 */
export function picRendu(): number | null {
  if (process.platform !== "linux") return null;
  return (require("../linux/hdr") as typeof import("../linux/hdr")).picSortie();
}
