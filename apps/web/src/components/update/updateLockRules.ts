/**
 * Le VERROU de la mise à jour — ses règles, pures.
 *
 * Tant qu'une mise à jour tourne (téléchargement, installation, redémarrage), l'application
 * derrière sa pop-up ne répond plus : un utilisateur a continué sa lecture pendant une mise à
 * jour (signalé par Damien, nov. 2026). La pop-up d'avant couvrait bien la fenêtre, mais le
 * clavier passait — le focus retombait sur la page dès que ses boutons partaient, et les
 * raccourcis du lecteur et de l'application vivent sur `window` —, et le PiP, lui, est une
 * AUTRE fenêtre.
 *
 * Ce module dit QUOI faire d'une touche ou d'un geste ; `updateLock.ts` l'applique au DOM.
 */

/** Qui tient le verrou : la pop-up de l'application, ou la surcouche de la coquille (CEF). */
export type UpdateLockReason = "app" | "shell";

/**
 *  - `pass` : pas de verrou, rien ne change ;
 *  - `allow` : la touche vaut pour la pop-up (activer son bouton) — son effet est gardé, mais
 *    elle ne se propage à AUCUN écouteur de l'application ;
 *  - `trap` : Tab — le focus tourne dans la pop-up, jamais derrière ;
 *  - `swallow` : tout le reste, avalé (Échap compris : une mise à jour ne s'interrompt pas).
 */
export type KeyVerdict = "pass" | "allow" | "trap" | "swallow";

export interface KeyFacts {
  locked: boolean;
  key: string;
  /** La touche vise un élément de la pop-up de l'application. */
  inZone: boolean;
  /** La touche vise la surcouche de la coquille, qui tient son propre piège de focus. */
  inShellOverlay: boolean;
}

const ACTIVATION_KEYS = new Set(["Enter", " ", "Spacebar"]);

export function keyVerdict({ locked, key, inZone, inShellOverlay }: KeyFacts): KeyVerdict {
  if (!locked) return "pass";
  if (inShellOverlay) return "allow";
  if (key === "Tab") return "trap";
  if (inZone && ACTIVATION_KEYS.has(key)) return "allow";
  return "swallow";
}

/** Un geste de pointeur (clic, molette, toucher) derrière la pop-up : avalé. */
export function pointerBlocked(facts: { locked: boolean; inZone: boolean; inShellOverlay: boolean }): boolean {
  return facts.locked && !facts.inZone && !facts.inShellOverlay;
}

/**
 * Où va le focus quand Tab tourne dans la pop-up : `count` éléments focalisables, le focus sur
 * `current` (−1 : ailleurs, ou sur le panneau lui-même). `null` : rien à focaliser — le panneau
 * le prend.
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0) return backwards ? count - 1 : 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}

/** Ce que le verrou sait d'un enfant de `<body>`. */
export interface BodyChildFacts {
  tag: string;
  /** C'est la pop-up (ou il la contient), ou la surcouche de la coquille. */
  holdsZone: boolean;
  /** Déjà inerte avant le verrou : on n'y touchera pas en le levant. */
  alreadyInert: boolean;
}

const NEVER_INERT = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT"]);

/**
 * Les enfants de `<body>` à rendre INERTES : tout sauf la pop-up. L'application (`#root`), les
 * portails des menus, des feuilles et des avis ouverts avant elle — rien derrière ne prend plus
 * ni focus, ni clic, ni lecteur d'écran.
 */
export function childrenToInert(children: readonly BodyChildFacts[]): number[] {
  const out: number[] = [];
  children.forEach((child, index) => {
    if (child.holdsZone || child.alreadyInert || NEVER_INERT.has(child.tag)) return;
    out.push(index);
  });
  return out;
}
