import { useSyncExternalStore } from "react";

/**
 * L'état du lecteur téléviseur, hors de l'arbre React.
 *
 * Trois lecteurs de cet état ne sont pas des composants : le moteur de focus,
 * qui doit savoir s'il a le droit de déplacer le focus sur cette route ; les
 * touches de transport globales, qui doivent se taire quand le lecteur est
 * monté ; et le contrôleur de touches lui-même, installé en capture sur le
 * document. Un contexte React ne leur servirait à rien. C'est le motif du
 * magasin externe, déjà employé par `usePinnedNav` et `useUserId`.
 *
 * **Le mode décide de tout.** `repos` : rien d'affiché, les flèches entrent
 * dans le déplacement du flux. `osd` : les commandes sont visibles, les flèches
 * appartiennent au moteur de focus. `scrub` : un curseur fantôme avance seul,
 * la vidéo est en pause, et aucun déplacement n'est appliqué avant
 * confirmation. Un seul propriétaire par touche, déduit de l'état — pas de
 * l'ordre d'installation des écouteurs.
 *
 * L'instantané ne change de référence que si quelque chose a changé : React
 * boucle sur « The result of getSnapshot should be cached » à la moindre
 * fabrication d'objet.
 */

export type ModeLecteur = "repos" | "osd" | "scrub";
export type PanneauOuvert = "aucun" | "pistes" | "episodes";

export interface EtatScrubPartage {
  position: number;
  palier: number;
}

export interface EtatLecteurTv {
  monte: boolean;
  mode: ModeLecteur;
  panneau: PanneauOuvert;
  scrub: EtatScrubPartage | null;
}

/** Cinq secondes : le temps de lire un titre sans que l'habillage s'installe. */
const MASQUAGE_MS = 5000;

const INITIAL: EtatLecteurTv = { monte: false, mode: "osd", panneau: "aucun", scrub: null };

let etat: EtatLecteurTv = INITIAL;
let enLecture = false;
let minuteur: ReturnType<typeof setTimeout> | null = null;
const auditeurs = new Set<() => void>();

function poser(suivant: Partial<EtatLecteurTv>): void {
  const fusion: EtatLecteurTv = { ...etat, ...suivant };
  if (
    fusion.monte === etat.monte &&
    fusion.mode === etat.mode &&
    fusion.panneau === etat.panneau &&
    fusion.scrub === etat.scrub
  ) {
    return;
  }
  etat = fusion;
  auditeurs.forEach((auditeur) => auditeur());
}

function arreterMinuteur(): void {
  if (minuteur === null) return;
  clearTimeout(minuteur);
  minuteur = null;
}

/**
 * Le masquage n'est armé qu'en lecture et hors panneau : une pause épingle les
 * commandes — c'est le retour visuel qu'on attend d'un lecteur — et un panneau
 * ouvert n'a aucune raison de disparaître sous le doigt.
 */
function armerMasquage(): void {
  arreterMinuteur();
  if (!enLecture || etat.panneau !== "aucun" || etat.mode !== "osd") return;
  minuteur = setTimeout(() => {
    minuteur = null;
    poser({ mode: "repos" });
  }, MASQUAGE_MS);
}

export function sAbonner(rappel: () => void): () => void {
  auditeurs.add(rappel);
  return () => {
    auditeurs.delete(rappel);
  };
}

export function lireEtat(): EtatLecteurTv {
  return etat;
}

export function useEtatLecteurTv(): EtatLecteurTv {
  return useSyncExternalStore(sAbonner, lireEtat);
}

export function poserMonte(monte: boolean): void {
  if (!monte) {
    arreterMinuteur();
    enLecture = false;
    poser({ monte: false, mode: "osd", panneau: "aucun", scrub: null });
    return;
  }
  poser({ monte: true, mode: "osd", panneau: "aucun", scrub: null });
  armerMasquage();
}

export function poserLecture(lecture: boolean): void {
  if (enLecture === lecture) return;
  enLecture = lecture;
  armerMasquage();
}

export function montrerOsd(): void {
  if (etat.mode === "scrub") return;
  poser({ mode: "osd" });
  armerMasquage();
}

/**
 * Repousse l'extinction sans toucher au mode.
 *
 * `montrerOsd()` FORCE le mode à `osd` — ce n'est pas ce qu'on veut d'un simple
 * déplacement de focus, qui doit dire « je suis là » sans rien décider. Sans ce
 * report, le minuteur armé au dernier `montrerOsd()` expirait sous les doigts :
 * l'habillage s'éteignait en pleine navigation, au bout de cinq secondes comptées
 * depuis son apparition et non depuis le dernier geste. La flèche encore tenue
 * se retrouvait alors du côté `repos`, où elle entre dans le flux.
 */
export function reporterMasquage(): void {
  if (etat.mode !== "osd") return;
  armerMasquage();
}

export function entrerScrub(position: number, palier: number): void {
  arreterMinuteur();
  poser({ mode: "scrub", panneau: "aucun", scrub: { position, palier } });
}

export function majScrub(position: number, palier: number): void {
  if (etat.mode !== "scrub") return;
  poser({ scrub: { position, palier } });
}

export function sortirScrub(): void {
  poser({ mode: "osd", scrub: null });
  armerMasquage();
}

export function poserPanneau(panneau: PanneauOuvert): void {
  poser({ panneau, mode: panneau === "aucun" ? etat.mode : "osd" });
  armerMasquage();
}

/** Le lecteur téléviseur est-il monté ? Lu par les touches globales. */
export function lecteurTvActif(): boolean {
  return etat.monte;
}

/**
 * Le moteur de focus a-t-il le droit d'agir sur la route du lecteur ?
 *
 * Oui quand les commandes sont visibles — ce sont des boutons comme les autres,
 * et le moteur les parcourt sans qu'on écrive une ligne. Non le reste du temps :
 * les flèches y appartiennent au déplacement dans le flux.
 */
export function navigationOsdActive(): boolean {
  return etat.monte && etat.mode === "osd";
}
