/**
 * Sur quel serveur d'affichage l'application tourne — et ce que ce choix coûte.
 *
 * # Le compromis, en deux lignes
 *
 * **X11 n'aura jamais de HDR** : X.Org l'a annoncé, il n'y a pas de protocole et
 * il n'y en aura pas. Le HDR sous Linux passe par `wp-color-management-v1`, qui
 * est un protocole **Wayland**.
 *
 * **Wayland n'autorise pas un client à placer ses fenêtres.** La fenêtre de mpv
 * ne peut donc être calée sur la nôtre qu'en PLEIN ÉCRAN, où la position ne se
 * discute pas. En fenêtré, seul X11 sait le faire.
 *
 * Aucun des deux ne gagne : l'utilisateur arbitre.
 *
 *   auto (défaut) — la session du bureau décide. KDE Wayland → HDR, et la
 *                   colle KWin garde la lecture fenêtrée. Autre bureau Wayland
 *                   (GNOME, wlroots) → XWayland quand aucun écran HDR n'est
 *                   branché (lecture fenêtrée, bouton plein écran qui marche),
 *                   Wayland sinon (HDR, lecture plein écran forcée). X11 →
 *                   lecture fenêtrée, pas de HDR.
 *   wayland       — Wayland natif imposé, quand la session s'y prête.
 *   x11           — X11 imposé (XWayland sous une session Wayland) : on retrouve
 *                   la lecture fenêtrée, on perd le HDR.
 *
 * # Pourquoi un fichier, et pas la base
 *
 * Le choix est lu AVANT `whenReady` — Electron exige que `--ozone-platform` soit
 * posé avant l'initialisation de la plateforme. `localDb.ts` dit pourquoi la base
 * ne s'ouvre pas à ce moment-là. Et le jour où l'application n'affiche plus rien,
 * ce réglage est précisément celui qu'il faut pouvoir corriger à la main, dans un
 * fichier lisible, sans lancer l'application.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export type SessionChoice = "auto" | "wayland" | "x11";
export type Montage = "wayland" | "x11";

/** Nom du fichier, dans le dossier de données. */
export const SESSION_FILE = "session-graphique.json";

export interface DecidedSession {
  /** Ce que l'utilisateur a demandé. */
  choice: SessionChoice;
  /** Ce que le bureau annonce. */
  session: Montage | "inconnue";
  /** Plateforme à imposer à Electron, ou `null` pour le laisser choisir. */
  ozone: Montage | null;
  /** Le montage vidéo qui en découle — c'est lui qui décide de tout le reste. */
  montage: Montage;
  /**
   * `auto` a choisi XWayland sous une session Wayland sans colle ni écran HDR
   * (voir `decideSession`). C'est un choix NON explicite qui peut tout de même
   * ne rien afficher : `session.ts` le surveille comme un choix explicite.
   */
  xwaylandAuto: boolean;
}

/** Ce que `decideSession` doit savoir du poste, au-delà de l'environnement. */
export interface SessionFacts {
  /** Un écran branché annonce PQ ou HLG (`edidHdr.ts`). */
  hdrDisplay: boolean;
  /** XWayland a déjà échoué à afficher en `auto` sur ce poste : ne plus le tenter. */
  xwaylandAutoBlocked: boolean;
}

/**
 * Le bureau offre-t-il la colle KWin ? Lu dans `XDG_CURRENT_DESKTOP` (`KDE`),
 * faute de mieux : il faut répondre avant `whenReady`, quand le ping D-Bus de
 * `kwinScripting.ts` n'est pas encore possible. Un KDE muet retombe sur le
 * montage forcé, qui marche ; jamais l'inverse.
 */
export function kdeDesktop(env: Record<string, string | undefined>): boolean {
  return (env["XDG_CURRENT_DESKTOP"] ?? "")
    .split(":")
    .some((name) => name.trim().toUpperCase() === "KDE");
}

function isChoice(v: unknown): v is SessionChoice {
  return v === "auto" || v === "wayland" || v === "x11";
}

/**
 * Ce que le bureau annonce, sans rien imposer.
 *
 * ⚠️ `DISPLAY` est posé AUSSI sous Wayland — c'est XWayland — et s'y fier seul
 * conclurait « X11 » sur toutes les sessions modernes. C'est `WAYLAND_DISPLAY`
 * qui tranche ; `XDG_SESSION_TYPE` ne sert qu'à le contredire, pour les
 * compositeurs minimalistes qui ne le posent pas du tout.
 */
export function desktopSession(env: Record<string, string | undefined>): Montage | "inconnue" {
  const wayland = (env["WAYLAND_DISPLAY"] ?? "") !== "";
  if (wayland && env["XDG_SESSION_TYPE"] !== "x11") return "wayland";
  if ((env["DISPLAY"] ?? "") !== "") return "x11";
  return "inconnue";
}

/**
 * Le choix, et ce qu'il implique.
 *
 * ⚠️ En `auto` on ne pose RIEN : depuis Electron 38, `--ozone-platform` vaut
 * `auto`, qui prend Wayland quand la session s'y prête **et se rabat sur X11
 * quand la connexion échoue**. Poser `wayland` explicitement supprimerait ce
 * repli — sur un poste où le compositeur refuse, l'application n'ouvrirait
 * simplement plus de fenêtre.
 *
 * ⚠️ Demander `wayland` depuis une session X11 n'a pas de sens : il n'y a pas de
 * compositeur à qui parler. La demande est ramenée à X11 plutôt que refusée,
 * pour qu'un réglage transporté d'une machine à l'autre ne bloque personne.
 *
 * # `auto` sous GNOME et wlroots : XWayland, sauf écran HDR
 *
 * Sans colle KWin, Wayland impose la lecture plein écran (`surfaceWayland.ts`) :
 * le bouton « sortir du plein écran » y était annulé aussitôt, et l'utilisateur
 * de Fedora Workstation le croyait cassé (22.10). Ce prix n'achète que le HDR ;
 * sans écran HDR, il n'achète rien. `auto` y prend donc XWayland — lecture
 * fenêtrée, bouton qui marche — et garde Wayland dès qu'un écran HDR est
 * branché (décision de Damien, 22.10). Il faut aussi un XWayland (`DISPLAY`) ;
 * sans `facts`, la règle d'avant (Wayland) tient.
 */
export function decideSession(
  env: Record<string, string | undefined>,
  choice: SessionChoice,
  facts?: SessionFacts,
): DecidedSession {
  const session = desktopSession(env);
  if (choice === "x11") return { choice, session, ozone: "x11", montage: "x11", xwaylandAuto: false };
  if (choice === "wayland") {
    if (session !== "wayland") return { choice, session, ozone: "x11", montage: "x11", xwaylandAuto: false };
    return { choice, session, ozone: "wayland", montage: "wayland", xwaylandAuto: false };
  }
  if (session !== "wayland") return { choice, session, ozone: null, montage: "x11", xwaylandAuto: false };
  const xwayland =
    facts !== undefined &&
    !facts.hdrDisplay &&
    !facts.xwaylandAutoBlocked &&
    !kdeDesktop(env) &&
    (env["DISPLAY"] ?? "") !== "";
  if (xwayland) return { choice, session, ozone: "x11", montage: "x11", xwaylandAuto: true };
  return { choice, session, ozone: null, montage: "wayland", xwaylandAuto: false };
}

/**
 * Le choix enregistré. `TENTACLE_LINUX_SESSION` le court-circuite — c'est ce qui
 * permet d'éprouver les deux montages sans toucher au réglage de l'utilisateur.
 */
export function readSessionChoice(dataFolder: string): SessionChoice {
  const force = process.env["TENTACLE_LINUX_SESSION"];
  if (isChoice(force)) return force;
  try {
    const raw: unknown = JSON.parse(readFileSync(path.join(dataFolder, SESSION_FILE), "utf8"));
    if (typeof raw === "object" && raw !== null) {
      const v = (raw as { session?: unknown }).session;
      if (isChoice(v)) return v;
    }
  } catch {
    // Fichier absent au premier lancement : c'est le cas normal, pas une erreur.
  }
  return "auto";
}
