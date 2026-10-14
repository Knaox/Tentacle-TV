/* ------------------------------------------------------------------ */
/*  Préparer une bande-annonce relayée, avant que le lecteur la demande */
/*                                                                     */
/*  La fiche de la TV la prépare pendant qu'on la lit ; l'aperçu au    */
/*  survol la VÉRIFIE avant de la proposer : extraite, maître et       */
/*  listes de départ lus chez googlevideo. Ce qui est lu reste avec la */
/*  vidéo (`trailerRelay.ts`) : le lecteur le trouve prêt.             */
/* ------------------------------------------------------------------ */

import { startVariant } from "./hlsPlaylists";
import { heldEntry, loadMaster, loadMedia, resolveEntry, resolvedOf, type ResolvedTrailer } from "./trailerRelay";
import { prefetchSegment } from "./trailerSegments";
import type { ExtractionOptions } from "./ytExtract";

/**
 * Prépare une vidéo pour que son lancement soit immédiat : extraction, maître,
 * liste de la variante de départ et de son audio. Rien n'échoue bruyamment :
 * le lancement refera ce qui manque. `true` : tout ce que le lecteur demandera
 * d'abord est là, lu chez googlevideo (un MP4 l'a été dès l'extraction) —
 * l'aperçu au survol ne propose rien d'autre.
 */
export async function prepareTrailer(ytId: string, extraction: ExtractionOptions = {}): Promise<boolean> {
  const entry = await resolveEntry(ytId, extraction);
  if (!entry) return false;
  if (entry.source.kind !== "hls") return true;
  const master = await loadMaster(entry);
  if (!master) return false;
  const start = startVariant(master.variants);
  const audio = master.audio.find((a) => a.group === start.audioGroup);
  const [video, sound] = await Promise.all([loadMedia(entry, start.key), audio ? loadMedia(entry, audio.key) : true]);
  return !!video && !!sound;
}

/**
 * La vidéo si le relais la tient DÉJÀ prête (extraite, maître lu) — sans
 * extraction ni lecture amont ; sinon `null`, et qui la veut la résout.
 */
export function peekTrailer(ytId: string): ResolvedTrailer | null {
  const entry = heldEntry(ytId);
  if (!entry || entry.validUntil <= Date.now() || (entry.source.kind === "hls" && !entry.master)) return null;
  entry.lastUsed = Date.now();
  return resolvedOf(entry);
}

/**
 * Prépare le DÉPART d'un aperçu au survol : le client part du plus petit
 * niveau qui couvre sa mini-carte (300 à 560 px de large) — 720p sur un écran
 * Retina, moins en densité 1 (`previewLevelCap.ts`, web). La variante de
 * départ des aperçus est donc la plus riche jusqu'à 720p (`startVariant`, le
 * départ de la TV aussi), avec l'audio de son groupe : leurs listes, puis
 * leur premier segment (et celui d'initialisation, s'il y en a un) sont lus
 * d'avance — jamais la 1080p, que le client ne demandera pas. Sans effet sur
 * une vidéo que le relais ne tient pas, ou sur un MP4.
 */
export async function warmStart(ytId: string): Promise<void> {
  const entry = heldEntry(ytId);
  if (!entry || entry.source.kind !== "hls") return;
  const master = await loadMaster(entry);
  const top = master && master.variants.length > 0 ? startVariant(master.variants) : null;
  if (!master || !top) return;
  const audio = master.audio.find((a) => a.group === top.audioGroup);
  await Promise.all([top.key, audio?.key].map(async (key) => {
    const media = key ? await loadMedia(entry, key) : null;
    if (!key || !media) return;
    if (media.init) prefetchSegment(ytId, key, "init");
    if (media.segments.length > 0) prefetchSegment(ytId, key, 0);
  }));
}
