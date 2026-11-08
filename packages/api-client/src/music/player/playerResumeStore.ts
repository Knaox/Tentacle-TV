/**
 * Octave — le STOCKAGE de la reprise du lecteur : une seule clé (`tentacle_octave_player`) pour toutes les
 * identités de l'appareil, `{ [identité]: { playback, at, launch } }`, les plus récentes d'abord.
 *
 * Écrire ne relit plus tout (lot « bat », 08/11) : le texte de la clé lu ou écrit la dernière fois est gardé avec,
 * pour chaque identité, son morceau de JSON déjà sérialisé. Tant que la clé n'a pas changé sous nous (un autre
 * onglet, un autre compte), rien n'est reparsé ni resérialisé hors de la session écrite ; une session identique à
 * celle déjà écrite (même file, même position, même lancement) n'écrit rien.
 * Clé de stockage : elle ne se renomme jamais.
 */

import type { SavedPlayback, SyncStorage } from "@tentacle-tv/shared/octave";

export const OCTAVE_PLAYER_KEY = "tentacle_octave_player";
/** Au plus tant d'identités gardées (les plus récentes), comme le cache des pages. */
const MAX_OWNERS = 4;

export interface StoredPlayer {
  playback: SavedPlayback | null;
  at: number;
  launch?: string;
}

type StoredPlayers = Record<string, StoredPlayer>;

export function parseStoredPlayers(raw: string | null): StoredPlayers {
  try {
    const parsed = JSON.parse(raw ?? "null") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StoredPlayers) : {};
  } catch {
    return {};
  }
}

/** Une identité telle qu'écrite : sa date (pour l'ordre) et son morceau de JSON (`"identité":{…}`). */
interface Fragment {
  at: number;
  text: string;
  /** La session écrite par CE lecteur, sans la date : deux écritures pareilles n'en font qu'une. */
  session: string | null;
}

export interface PlayerResumeWriter {
  write(owner: string, playback: SavedPlayback | null, at: number, launch: string): void;
}

export function createPlayerResumeWriter(storage: SyncStorage): PlayerResumeWriter {
  /** Le texte de la clé que les morceaux décrivent (`undefined` : rien de connu). */
  let known: string | null | undefined;
  let fragments = new Map<string, Fragment>();

  const follow = (): void => {
    const raw = storage.getItem(OCTAVE_PLAYER_KEY);
    if (raw === known) return;
    known = raw;
    fragments = new Map();
    for (const [owner, entry] of Object.entries(parseStoredPlayers(raw))) {
      fragments.set(owner, { at: entry?.at ?? 0, text: `${JSON.stringify(owner)}:${JSON.stringify(entry)}`, session: null });
    }
  };

  return {
    write(owner, playback, at, launch) {
      follow();
      const session = `"playback":${JSON.stringify(playback)},"launch":${JSON.stringify(launch)}`;
      if (fragments.get(owner)?.session === session) return;
      fragments.set(owner, { at, text: `${JSON.stringify(owner)}:{${session},"at":${JSON.stringify(at)}}`, session });
      const kept = [...fragments.entries()].sort(([, a], [, b]) => b.at - a.at).slice(0, MAX_OWNERS);
      fragments = new Map(kept);
      const text = `{${kept.map(([, fragment]) => fragment.text).join(",")}}`;
      try {
        storage.setItem(OCTAVE_PLAYER_KEY, text);
        known = text;
      } catch {
        /* stockage plein ou bloqué : la prochaine ouverture repartira d'une barre vide */
        known = undefined;
      }
    },
  };
}
