/**
 * Watch Together — les BULLES de réactions à l'écran, en module pur. Le chat
 * partagé fusionne déjà une rafale en une entrée comptée (`count`, nouvelle
 * clé à chaque réaction) ; ici, l'affichage : une bulle STABLE par membre et
 * contenu (elle pulse au lieu de renaître), les comptes additionnés si deux
 * entrées du même membre se chevauchent, le nombre de bulles borné (les plus
 * récentes), et une voie fixe — rien ne saute de côté quand une autre s'efface.
 */

/** Une réaction reçue, telle que le chat partagé la tient (`WtFloatingReaction`). */
export interface ReactionLike {
  key: string;
  userId: string;
  username: string;
  emoji?: string;
  gif?: { url: string; w?: number; h?: number };
  /** Rafale déjà fusionnée par le chat partagé (absent : 1). */
  count?: number;
}

export interface ReactionBurst {
  /** Stable tant que la rafale vit : membre + contenu. */
  id: string;
  username: string;
  emoji?: string;
  gif?: { url: string; w?: number; h?: number };
  count: number;
  /** Clé de la DERNIÈRE réaction : change à chaque nouvelle (déclenche la pulsation). */
  lastKey: string;
  /** Voie d'affichage, stable pour un `id`. */
  lane: number;
}

export const REACTION_BURST_MAX = 8;
export const REACTION_LANES = 3;

/** Voie stable d'une rafale (somme simple des codes : déterministe, sans état). */
export function reactionLane(id: string, lanes: number = REACTION_LANES): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) % 9973;
  return sum % lanes;
}

export function reactionBursts(reactions: readonly ReactionLike[], max: number = REACTION_BURST_MAX): ReactionBurst[] {
  const byId = new Map<string, ReactionBurst>();
  const order: string[] = [];
  for (const r of reactions) {
    const content = r.gif ? `gif:${r.gif.url}` : `emoji:${r.emoji ?? ""}`;
    const id = `${r.userId}|${content}`;
    const existing = byId.get(id);
    if (existing) {
      existing.count += r.count ?? 1;
      existing.lastKey = r.key;
      // La rafale la plus récemment nourrie passe en dernier (la plus « fraîche »).
      order.splice(order.indexOf(id), 1);
      order.push(id);
    } else {
      byId.set(id, { id, username: r.username, emoji: r.emoji, gif: r.gif, count: r.count ?? 1, lastKey: r.key, lane: reactionLane(id) });
      order.push(id);
    }
  }
  return order.slice(-max).map((id) => byId.get(id)!);
}
