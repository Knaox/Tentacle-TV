/**
 * Watch Together — le chat INTERACTIF : débit en rafale et « est en train
 * d'écrire » (lot du 20/10, demande de Damien : enchaîner sans frein emojis,
 * réactions, GIF et messages, sur toutes les plateformes).
 *
 * Le débit se tient par un SEAU À JETONS par membre et par sorte : une rafale
 * jusqu'à la capacité, puis le rythme soutenu. Au-delà, le serveur ignore en
 * silence (le spam ne mérite pas de réponse) ; le client applique la même
 * règle avant d'envoyer, pour ne jamais perdre un geste sans le savoir. Les
 * rafales d'emojis identiques se REGROUPENT à l'affichage (« 🔥 ×5 »), elles
 * ne sont pas refusées.
 *
 * Recopié tel quel dans le backend
 * (`apps/backend/src/services/watchTogether/watchTogetherChat.ts`) — aucun
 * import, `cp` suffit ; `protocolMirror.test.ts` tient les deux copies.
 */

export interface WtRatePolicy {
  /** Ce qu'une rafale peut envoyer d'un coup. */
  capacity: number;
  /** Le rythme soutenu ensuite (jetons rendus par seconde). */
  perSecond: number;
}

export const WT_CHAT_RATES = {
  /** Messages : une dizaine d'affilée, puis deux par seconde. */
  message: { capacity: 10, perSecond: 2 },
  /** Réactions : une rafale de vingt, puis dix par seconde — l'enchaînement est voulu. */
  reaction: { capacity: 20, perSecond: 10 },
  /** GIF : plus lourds à l'écran — six d'affilée, puis un par seconde. */
  gif: { capacity: 6, perSecond: 1 },
  /** « Est en train d'écrire » : au plus un par seconde en régime (le client en envoie un toutes les 2 s). */
  typing: { capacity: 3, perSecond: 1 },
} as const satisfies Record<string, WtRatePolicy>;

export type WtChatRateKind = keyof typeof WT_CHAT_RATES;

export interface WtRateBucket {
  tokens: number;
  /** Instant du dernier calcul (ms). */
  at: number;
}

/** Prend un jeton s'il y en a : `allowed`, et le seau à garder. */
export function takeWtRateToken(
  bucket: WtRateBucket | undefined,
  policy: WtRatePolicy,
  now: number,
): { allowed: boolean; bucket: WtRateBucket } {
  const elapsedS = bucket ? Math.max(0, now - bucket.at) / 1000 : 0;
  const tokens = bucket ? Math.min(policy.capacity, bucket.tokens + elapsedS * policy.perSecond) : policy.capacity;
  if (tokens < 1) return { allowed: false, bucket: { tokens, at: now } };
  return { allowed: true, bucket: { tokens: tokens - 1, at: now } };
}

/** « Est en train d'écrire » : le client le redit toutes les 2 s tant qu'on tape,
 *  le tient fini après 4 s sans frappe ; le serveur l'éteint seul après 6 s
 *  sans nouvelle (onglet fermé, réseau coupé). */
export const WT_TYPING_RESEND_MS = 2_000;
export const WT_TYPING_IDLE_MS = 4_000;
export const WT_TYPING_TTL_MS = 6_000;

/** Deux réactions identiques d'un même membre à moins de ce délai : une seule, comptée. */
export const WT_REACTION_GROUP_MS = 1_200;
