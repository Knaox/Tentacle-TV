import type { WtMemberDto } from "../types/watchTogether";

/**
 * Watch Together — ce qu'on dit d'un membre, partout pareil (web, bureau,
 * mobile) : son état (l'anneau de l'avatar) et son libellé.
 */

export type WtMemberStatus = "none" | "watching" | "buffering" | "error" | "offline";

export function wtMemberStatus(m: WtMemberDto): WtMemberStatus {
  if (!m.online) return "offline";
  if (m.playbackError) return "error";
  if (m.buffering) return "buffering";
  if (m.inPlayback) return "watching";
  return "none";
}

/** La clé du libellé d'état (espace i18n `watchTogether`). */
export type WtMemberStatusLabelKey = "cantPlay" | "bufferingStatus" | "watching" | "online" | "offline";

export function wtMemberStatusLabelKey(m: WtMemberDto): WtMemberStatusLabelKey {
  if (m.playbackError) return "cantPlay";
  if (m.buffering) return "bufferingStatus";
  if (m.inPlayback) return "watching";
  return m.online ? "online" : "offline";
}

/** Les réactions à portée de main du chat (le sélecteur complet : `EMOJI_CATEGORIES`). */
export const WT_QUICK_REACTIONS = ["😂", "❤️", "🔥", "😮", "👍", "😭"] as const;
