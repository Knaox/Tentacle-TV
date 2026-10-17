/**
 * La ZONE D'APERÇU (Apple TV, Android TV) — décision du 18/10, qui remplace
 * la carte qui grandissait : l'aperçu se joue TOUJOURS au même endroit, une
 * zone fixe en haut de l'écran, façon Netflix au salon (Accueil, Pour vous,
 * grilles). Les cartes ne grandissent plus.
 *
 * Ce module dit CE QUE la zone montre et QUAND, sans rien dessiner :
 *
 * - le SUJET : la carte focalisée, aussitôt (0 ms : son fond paraît au focus,
 *   jamais après un délai) ; le focus parti vers autre chose qu'une carte
 *   (filtres, rail), la zone GARDE la dernière carte — elle ne se vide jamais
 *   sous les yeux. Sur l'Accueil, le héros est un sujet : son focus (ses
 *   boutons) remet le titre mis en avant. Avant tout focus : le héros, sinon
 *   le repli de la page (`fallback` — la première affiche d'une grille) ;
 * - `focused` : le sujet a le focus EN CE MOMENT — seule condition pour que sa
 *   bande-annonce soit demandée et jouée (la machine de shared, au délai de
 *   l'utilisateur) ; `since` date l'arrivée de ce focus ;
 * - les DÉTAILS (synopsis, genres, durée) se lisent quand le focus a tenu
 *   `PREVIEW_ZONE_DETAILS_MS` : une rafale de flèches ne lit rien, le fond et
 *   le titre de chaque carte traversée suffisent.
 *
 * Module pur, horloge injectée (`at`).
 */

/** Le focus tenu avant de lire les détails du titre (synopsis…) : un parcours de rangée ne lit rien. */
export const PREVIEW_ZONE_DETAILS_MS = 300;

/**
 * Les fondus de la zone — n'animer que l'opacité (aucune remise en page) :
 * le fond d'une carte entre par-dessus le précédent, qui reste plein dessous ;
 * la vidéo entre sur le fond à sa première image, plus lentement, et s'en va
 * vite (le mouvement d'Apple TV : la sortie plus brève que l'entrée).
 */
export const PREVIEW_ZONE_FADE = {
  backdropMs: 200,
  textMs: 160,
  videoInMs: 360,
  videoOutMs: 180,
} as const;

/**
 * Le lecteur de la zone reste monté (une seule vidéo, dont on change la
 * source — jamais démonté puis remonté entre deux cartes) ; resté sans rien à
 * jouer aussi longtemps, il se démonte (la mémoire d'un AVPlayer en pause).
 */
export const PREVIEW_ZONE_PLAYER_IDLE_MS = 30_000;

export type PreviewZoneSubject = { kind: "card"; id: string } | { kind: "hero" };

export interface PreviewZoneState {
  /** Ce qui a eu le focus en dernier : `null` avant tout focus. */
  subject: PreviewZoneSubject | null;
  /** Le sujet a le focus en ce moment. */
  focused: boolean;
  /** L'arrivée de ce focus. */
  since: number | null;
}

export const INITIAL_PREVIEW_ZONE: PreviewZoneState = { subject: null, focused: false, since: null };

export type PreviewZoneEvent =
  | { type: "focusCard"; id: string; at: number }
  | { type: "blurCard"; id: string; at: number }
  | { type: "focusHero"; at: number }
  | { type: "blurHero"; at: number };

const sameSubject = (a: PreviewZoneSubject | null, b: PreviewZoneSubject): boolean =>
  a !== null && a.kind === b.kind && (a.kind === "hero" || (b.kind === "card" && a.id === b.id));

export function reducePreviewZone(state: PreviewZoneState, event: PreviewZoneEvent): PreviewZoneState {
  switch (event.type) {
    case "focusCard":
      return focus(state, { kind: "card", id: event.id }, event.at);
    case "focusHero":
      return focus(state, { kind: "hero" }, event.at);
    case "blurCard":
      return blur(state, { kind: "card", id: event.id });
    case "blurHero":
      return blur(state, { kind: "hero" });
  }
}

function focus(state: PreviewZoneState, subject: PreviewZoneSubject, at: number): PreviewZoneState {
  // Le même sujet qui garde le focus (un rendu de plus) ne repart pas de zéro.
  if (state.focused && sameSubject(state.subject, subject)) return state;
  return { subject, focused: true, since: at };
}

function blur(state: PreviewZoneState, subject: PreviewZoneSubject): PreviewZoneState {
  // Un flou qui arrive APRÈS le focus du suivant (l'ordre des effets) ne touche à rien.
  if (!state.focused || !sameSubject(state.subject, subject)) return state;
  return { ...state, focused: false, since: null };
}

/** Ce que la zone montre : le dernier sujet focalisé, sinon le héros s'il y en a un, sinon le repli. */
export function previewZoneShown(
  state: PreviewZoneState,
  options: { hasHero: boolean; fallbackId: string | null },
): PreviewZoneSubject | null {
  if (state.subject?.kind === "hero" && !options.hasHero) return options.fallbackId ? { kind: "card", id: options.fallbackId } : null;
  if (state.subject) return state.subject;
  if (options.hasHero) return { kind: "hero" };
  return options.fallbackId ? { kind: "card", id: options.fallbackId } : null;
}

/** Le temps qui reste avant de lire les détails du sujet focalisé (0 : maintenant), ou `null` sans focus. */
export function previewZoneDetailsIn(state: PreviewZoneState, now: number): number | null {
  if (!state.focused || state.since === null) return null;
  return Math.max(0, state.since + PREVIEW_ZONE_DETAILS_MS - now);
}

/**
 * Les deux calques du fond (A, B), en fondu croisé : l'image NEUVE se pose sur
 * le calque qui n'est pas devant, et entre par-dessus — le calque de devant
 * reste plein dessous, aucun noir entre deux fonds. Rend le calque qui reçoit
 * `uri`, ou `null` si l'image est déjà devant.
 */
export function previewZoneBackdropLayer(layers: { front: 0 | 1; uris: readonly [string | null, string | null] }, uri: string): 0 | 1 | null {
  if (layers.uris[layers.front] === uri) return null;
  return layers.front === 0 ? 1 : 0;
}
