/**
 * Les gardes de VRAISEMBLANCE des passages réclamés par les fournisseurs.
 *
 * Un détecteur par empreinte audio matche de la MUSIQUE, pas des images : un
 * opening joué pendant l'épilogue produit une « Intro » posée sur la scène
 * post-générique. Mesuré le 30.08 sur Re:Zero S4E4 (23 min 30) : Intro
 * 19:12 → 20:00 — à 82 % du fichier — doublée d'un Outro 19:12 → 20:36 sur la
 * même zone. Le spectateur voyait « Passer l'intro » au milieu de l'épilogue.
 *
 * Deux règles, chacune infaillible seule :
 *
 *  1. **la position** — aucune vraie intro ne commence passé la MOITIÉ du
 *     média (Intro Skipper lui-même les cherche dans le premier quart) ;
 *  2. **la contradiction** — une même zone ne peut pas être à la fois l'intro
 *     et le générique de fin. Quand une intro écartée par la première règle
 *     chevauche un Outro réclamé, le détecteur s'est visiblement perdu là :
 *     l'Outro tombe avec elle. La règle ne s'applique QU'AUX intros déjà
 *     écartées — deux réclamations légitimes ne se touchent jamais.
 *
 * Les gardes passent APRÈS les chapitres (un chapitre nommé « intro » posé en
 * fin de fichier est tout aussi absurde) et AVANT le verdict des vignettes.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import type { BoundsByType, RawBounds } from "./segmentChapters";

/** Une intro qui commence passé cette part du média n'en est pas une. */
export const INTRO_MAX_START_RATIO = 0.5;

/**
 * Part du plus court des deux passages au-delà de laquelle un chevauchement
 * cesse d'être un frôlement : les deux réclamations décrivent la même zone.
 */
const CONTRADICTION_OVERLAP_RATIO = 0.5;

function describeSameZone(a: RawBounds, b: RawBounds): boolean {
  const overlap = Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
  const shorter = Math.min(a.endMs - a.startMs, b.endMs - b.startMs);
  return shorter > 0 && overlap >= shorter * CONTRADICTION_OVERLAP_RATIO;
}

/** Applique les deux gardes, en place. Durée inconnue : on ne juge rien. */
export function applyClaimGuards(bounds: BoundsByType, runtimeMs: number): void {
  if (runtimeMs <= 0) return;
  const intros = bounds.get("Intro");
  if (!intros || intros.length === 0) return;

  const kept: RawBounds[] = [];
  const dropped: RawBounds[] = [];
  for (const intro of intros) {
    (intro.startMs > runtimeMs * INTRO_MAX_START_RATIO ? dropped : kept).push(intro);
  }
  if (dropped.length === 0) return;
  if (kept.length > 0) bounds.set("Intro", kept);
  else bounds.delete("Intro");

  const outros = bounds.get("Outro");
  if (!outros || outros.length === 0) return;
  const keptOutros = outros.filter(
    (outro) => !dropped.some((intro) => describeSameZone(intro, outro)),
  );
  if (keptOutros.length === outros.length) return;
  if (keptOutros.length > 0) bounds.set("Outro", keptOutros);
  else bounds.delete("Outro");
}
