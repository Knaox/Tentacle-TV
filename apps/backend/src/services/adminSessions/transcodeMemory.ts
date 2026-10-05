import type { RawSession } from "./mapSession";

/**
 * Ce que Jellyfin a encodé pour une lecture, retenu jusqu'à la fin de cette
 * lecture.
 *
 * `TranscodingInfo` n'est PAS un état fiable — mesuré sur Jellyfin 10.11.11
 * (2026-10-05), relevé toutes les 500 ms pendant un vrai transcodage HLS :
 * présent ~1 s après le premier segment, puis il CLIGNOTE
 * (`TTTTTTTTT·T·T···`), et il disparaît dès que ffmpeg a fini — alors que le
 * lecteur lit encore les segments. Sans mémoire, la carte d'un remux ou d'un
 * transcodage audio sautait au « transcodage » (pris au pire) à chaque trou.
 *
 * La règle : un encodage vu pour (session, titre) tient jusqu'à ce que la
 * session change de titre, s'arrête, ou se dise en lecture directe.
 */

type Transcoding = NonNullable<RawSession["TranscodingInfo"]>;

interface Remembered {
  itemId: string;
  info: Transcoding;
}

export class TranscodeMemory {
  private readonly seen = new Map<string, Remembered>();

  /** Une liste COMPLÈTE de sessions (trame de la socket, ou `/Sessions`). */
  observe(raw: readonly unknown[]): void {
    const present = new Set<string>();
    for (const value of raw) {
      if (value === null || typeof value !== "object") continue;
      const session = value as RawSession;
      if (!session.Id) continue;
      present.add(session.Id);
      const itemId = session.NowPlayingItem?.Id;
      const known = this.seen.get(session.Id);
      // Plus de lecture, ou un autre titre : ce qui était encodé ne vaut plus.
      if (known && known.itemId !== itemId) this.seen.delete(session.Id);
      if (itemId && session.TranscodingInfo) this.seen.set(session.Id, { itemId, info: session.TranscodingInfo });
    }
    for (const id of this.seen.keys()) if (!present.has(id)) this.seen.delete(id);
  }

  /** La session, avec l'encodage retenu pour son titre quand Jellyfin le tait (trou, ffmpeg fini). */
  recall(session: RawSession): RawSession {
    if (session.TranscodingInfo || !session.Id) return session;
    const known = this.seen.get(session.Id);
    if (!known || known.itemId !== session.NowPlayingItem?.Id) return session;
    // Un client revenu en lecture directe sur le même titre n'est plus transcodé.
    if (session.PlayState?.PlayMethod === "DirectPlay") return session;
    return { ...session, TranscodingInfo: known.info };
  }
}

/** La mémoire du processus : nourrie par chaque trame de la socket et chaque instantané. */
export const transcodeMemory = new TranscodeMemory();
