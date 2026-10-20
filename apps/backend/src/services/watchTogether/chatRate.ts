import { takeWtRateToken, WT_CHAT_RATES, type WtChatRateKind } from "./protocol";
import type { Room } from "./roomTypes";

/**
 * Watch Together — le débit du chat, par membre et par sorte : une rafale
 * jusqu'à la capacité, puis le rythme soutenu (`WT_CHAT_RATES`, contrat
 * partagé avec les clients, qui appliquent la même règle avant d'envoyer).
 * Au-delà : ignoré en silence — le spam ne mérite pas de réponse.
 */
export function allowChat(room: Room, userId: string, kind: WtChatRateKind, now: number = Date.now()): boolean {
  const key = `${userId}:${kind}`;
  const { allowed, bucket } = takeWtRateToken(room.chatRate.get(key), WT_CHAT_RATES[kind], now);
  room.chatRate.set(key, bucket);
  return allowed;
}
