/**
 * Octave — le TITRE de la seconde file à l'écran : la suite de ce qui joue
 * (« Suite de l'album », « Suite de la playlist »…), lu sur le contexte de la
 * file (`queue.contextId`, posé par la page qui a lancé la lecture). Le même au
 * bureau et sur le mobile ; la clé est dans l'espace i18n `music`.
 */

export type QueueContextKind = "album" | "playlist" | "artist" | "liked" | "mood" | "radio" | "other";

export function queueContextKind(contextId: string | null): QueueContextKind {
  if (contextId === null) return "other";
  if (contextId === "liked" || contextId === "playlist:liked") return "liked";
  const prefix = contextId.split(":", 1)[0];
  switch (prefix) {
    case "album":
    case "playlist":
    case "artist":
    case "mood":
    case "radio":
      return contextId.length > prefix.length + 1 ? prefix : "other";
    default:
      return "other";
  }
}

const KEYS: Record<QueueContextKind, string> = {
  album: "queue.fromAlbum",
  playlist: "queue.fromPlaylist",
  artist: "queue.fromArtist",
  liked: "queue.fromLiked",
  mood: "queue.fromMood",
  radio: "queue.fromRadio",
  other: "queue.fromContext",
};

/** La clé i18n (espace `music`) du titre de la file du contexte. */
export function queueContextTitleKey(contextId: string | null): string {
  return KEYS[queueContextKind(contextId)];
}
