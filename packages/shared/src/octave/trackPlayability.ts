/**
 * Octave — la LISIBILITÉ d'un titre, lue de la même façon par le web, le bureau et le mobile (lot « ol », 01/11).
 *
 * L'extension dit (contrat d'ol3) `playable` : `"yes"`, `"no"` (avec sa raison dans `unavailable`) ou `"unknown"`
 * (pas encore vérifié). Une extension ou un serveur d'avant n'envoie que `unavailable` (lot « fl ») : posé, le titre
 * ne se lit pas — comportement d'avant, sans rien de plus.
 * - `unknown` n'est JAMAIS grisé : l'état arrive ensuite, sur place, sans déplacer la ligne ;
 * - un titre de la BIBLIOTHÈQUE se lit toujours ;
 * - un titre illisible garde le cœur, le menu, « Ajouter à une playlist » : le serveur pourra le récupérer.
 */

import type { MusicTrack, MusicUnavailableReason } from "../music";

/** Ce que le client montre : lisible, pas lisible (grisé), ou pas encore su (rendu comme lisible). */
export type TrackPlayabilityState = "playable" | "unplayable" | "unknown";

/**
 * La raison DITE à l'utilisateur. Une raison que ce client ne connaît pas encore devient `other` (« pas lisible »,
 * sans plus) : la liste des raisons de l'extension peut s'allonger sans casser un client livré.
 */
export type UnplayableReason = "notStreamable" | "notPublic" | "region" | "removed" | "ageRestricted" | "private" | "other";

const KNOWN_REASONS: ReadonlySet<string> = new Set<UnplayableReason>(["notStreamable", "notPublic", "region", "removed", "ageRestricted", "private"]);

export interface TrackPlayability {
  state: TrackPlayabilityState;
  /** Posée pour `unplayable` seulement. */
  reason: UnplayableReason | null;
  /** Grisé, et un geste de lecture (clic, toucher, Entrée, la file) ne lance rien. */
  greyed: boolean;
}

type PlayabilityInput = Pick<MusicTrack, "jellyfinId" | "unavailable"> & { playable?: MusicTrack["playable"] };

const PLAYABLE: TrackPlayability = { state: "playable", reason: null, greyed: false };
const UNKNOWN: TrackPlayability = { state: "unknown", reason: null, greyed: false };

export function reasonOf(raw: MusicUnavailableReason | string | null | undefined): UnplayableReason {
  return raw && KNOWN_REASONS.has(raw) ? (raw as UnplayableReason) : "other";
}

export function trackPlayability(track: PlayabilityInput): TrackPlayability {
  if (track.jellyfinId) return PLAYABLE;
  // Le contrat d'ol3 d'abord : il fait foi dès qu'il est là, même s'il contredit une vieille marque.
  if (track.playable === "yes") return PLAYABLE;
  if (track.playable === "unknown") return UNKNOWN;
  if (track.playable === "no") return { state: "unplayable", reason: reasonOf(track.unavailable), greyed: true };
  // Une valeur de `playable` inconnue de ce client, ou son absence (extension d'avant) : la marque de « fl ».
  if (track.unavailable != null) return { state: "unplayable", reason: reasonOf(track.unavailable), greyed: true };
  return PLAYABLE;
}

/** La clé i18n (espace `music`) de la phrase qui dit pourquoi. */
export function unplayableReasonKey(reason: UnplayableReason | null): string {
  return `unplayableTrack.reason.${reason ?? "other"}`;
}

export interface UnplayableActionsInput {
  canLike: boolean;
  canAddToPlaylist: boolean;
  liked: boolean;
}

/** Les gestes proposés par l'avis (ou la feuille) d'un titre illisible : ce que le compte peut faire, rien d'autre. */
export interface UnplayableActions {
  like: boolean;
  /** Déjà aimé : le bouton dit « Retirer des favoris », pas « Ajouter ». */
  liked: boolean;
  addToPlaylist: boolean;
}

export function unplayableActions(input: UnplayableActionsInput): UnplayableActions {
  return { like: input.canLike, liked: input.canLike && input.liked, addToPlaylist: input.canAddToPlaylist };
}

/** Un état arrivé après coup (révision, route de lot) : posé sur le titre, ou le même objet s'il ne change rien. */
export function withPlayability<T extends PlayabilityInput>(track: T, patch: { playable: MusicTrack["playable"]; unavailable?: MusicUnavailableReason | null }): T {
  const unavailable = patch.playable === "no" ? (patch.unavailable ?? track.unavailable ?? null) : null;
  if (track.playable === patch.playable && (track.unavailable ?? null) === unavailable) return track;
  return { ...track, playable: patch.playable, unavailable };
}

export type UnplayableGesture = "addToPlaylist" | "like";

/** Ce que l'avis (web, bureau) ou la feuille (mobile) d'un titre illisible dit et propose — mêmes mots partout. */
export interface UnplayableNotice {
  titleKey: string;
  reasonKey: string;
  /** « Il reste disponible… » : seulement s'il reste un geste, ou qu'il est déjà dans les favoris. */
  keepKey: string | null;
  /** Le geste principal d'abord (la playlist si elle est là, sinon le favori), puis l'autre. */
  gestures: UnplayableGesture[];
  liked: boolean;
}

export function unplayableNotice(track: PlayabilityInput, input: UnplayableActionsInput): UnplayableNotice {
  const can = unplayableActions(input);
  const gestures: UnplayableGesture[] = [];
  if (can.addToPlaylist) gestures.push("addToPlaylist");
  if (can.like && !can.liked) gestures.push("like");
  return {
    titleKey: "unplayableTrack.title",
    reasonKey: unplayableReasonKey(trackPlayability(track).reason),
    keepKey: gestures.length > 0 || can.liked ? "unplayableTrack.keep" : null,
    gestures,
    liked: can.liked,
  };
}
