/**
 * Octave — les identités qui CHANGENT, règle PURE (`keptRenames.test.ts`). Une
 * entrée importée que l'extension rapproche d'une source change de clé
 * (Sillon : `ext:sillon:imp:<clé>` → `ext:sillon:ytm:t:<vidéo>`) ; l'extension
 * le dit dans ses attentes (`PendingMusicItem.formerIds`, contrat additif).
 *
 * Sans cela, la copie gardée sous l'ancienne clé n'était plus reconnue : ni
 * marque, ni lecture depuis le disque, ni tenue à jour — et « garder les titres
 * qui manquent » la gardait une seconde fois (relevé du 27/10, playlist « New » :
 * « L'assasymphonie » et « Working Overtime » gardés deux fois).
 */

import { externalTrackKey, type MusicTrack, type PendingMusicItem } from "@tentacle-tv/shared/music";

/** Les identités d'hier, chacune vers le titre d'AUJOURD'HUI (clé `ext:` → titre). Une identité ambiguë est écartée. */
export function renamesOf(items: readonly PendingMusicItem[]): Map<string, MusicTrack> {
  const out = new Map<string, MusicTrack>();
  const ambiguous = new Set<string>();
  for (const item of items) {
    const pluginId = item.track.external?.pluginId;
    if (!pluginId || !Array.isArray(item.formerIds)) continue;
    for (const former of item.formerIds) {
      if (typeof former !== "string" || former.length === 0 || former === item.externalId) continue;
      const key = externalTrackKey({ pluginId, id: former });
      if (key === item.track.key || ambiguous.has(key)) continue;
      const known = out.get(key);
      // Deux titres d'aujourd'hui pour une même identité d'hier : on ne choisit pas, rien n'est rapproché.
      if (known && known.key !== item.track.key) {
        out.delete(key);
        ambiguous.add(key);
        continue;
      }
      out.set(key, item.track);
    }
  }
  return out;
}

/** Le sens du magasin : la clé MONTRÉE aujourd'hui → les clés d'hier sous lesquelles une copie a pu être gardée. */
export function shownToFormer(renames: ReadonlyMap<string, MusicTrack>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [former, track] of renames) out.set(track.key, [...(out.get(track.key) ?? []), former]);
  return out;
}
