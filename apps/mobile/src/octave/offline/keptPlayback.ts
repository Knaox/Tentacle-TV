/**
 * Octave (mobile) — le PORT de lecture des titres gardés, pour le moteur audio
 * (m2) : la copie gardée d'abord, en ligne comme hors ligne (aucune requête,
 * démarrage immédiat). La règle est celle du bureau
 * (`@tentacle-tv/offline-core/music` › `keptSources.ts`) ; le mobile y ajoute
 * le fichier lui-même (`kept.localUri`, `file://…`), revérifié sur le disque à
 * chaque lecture. Sans copie complète, `null` : le moteur suit ses résolveurs.
 *
 * Branchement côté lecteur : `withKeptSources(resolvers)` autour des résolveurs
 * du `SourceCache`, puis lire `source.kept?.localUri ?? source.url`.
 */

import { keptSource, withKeptSources as withKept } from "@tentacle-tv/offline-core/music";
import type { PlaybackSource } from "@tentacle-tv/shared/music";
import type { SourceResolvers } from "@tentacle-tv/shared/octave";
import { keptMusicFileUri } from "../../offline/engineMusicApi";
import { keptMusicStore } from "./keptMusic";

/** La source de la copie complète de ce titre sur ce téléphone ; `null` : rien de gardé (ou le fichier manque). */
export function keptPlaybackSource(trackKey: string): PlaybackSource | null {
  const { userId } = keptMusicStore.state();
  const kept = userId === null ? null : keptMusicStore.completeTrack(trackKey);
  if (!kept || userId === null) return null;
  // Sous la clé de la COPIE : un titre qui a changé d'identité depuis est gardé sous celle d'hier.
  const localUri = keptMusicFileUri(userId, kept.trackKey);
  return localUri === null ? null : keptSource(kept, userId, localUri);
}

/** Les résolveurs du lecteur, la copie gardée d'abord. */
export function withKeptSources(resolvers: SourceResolvers): SourceResolvers {
  return withKept(resolvers, keptPlaybackSource);
}

/** L'adresse que le moteur lit : le fichier gardé s'il est là, sinon celle du serveur. */
export function playableUri(source: PlaybackSource): string {
  return source.kept?.localUri ?? source.url;
}
