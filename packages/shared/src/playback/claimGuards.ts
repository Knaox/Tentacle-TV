/**
 * La garde de VRAISEMBLANCE des passages réclamés par les fournisseurs.
 *
 * Un détecteur par empreinte audio matche de la MUSIQUE, pas des images : un
 * opening joué pendant le générique de fin produit une « Intro » posée sur la
 * fin de l'épisode. Mesuré le 30.08 sur Re:Zero S4E4 (23 min 30) : Intro
 * 19:12 → 20:00 — à 82 % du fichier. Le spectateur voyait « Passer l'intro »
 * en plein épilogue.
 *
 * UNE règle, infaillible : aucune vraie intro ne commence passé la MOITIÉ du
 * média (Intro Skipper lui-même les cherche dans le premier quart).
 *
 * ⚠️ Il n'y a PAS de règle « l'Outro chevauchant tombe avec elle », et c'est
 * une leçon : sur ce même épisode, l'Outro posé sur la même zone (19:12 →
 * 20:36) décrivait le VRAI générique de fin, et la scène qu'il révèle après
 * lui existe (rapporté par l'utilisateur, vérifié aux vignettes). Une
 * étiquette absurde n'invalide pas sa voisine — la culpabilité par
 * association a coûté un bouton post-générique légitime.
 *
 * La garde passe APRÈS les chapitres (un chapitre nommé « intro » posé en fin
 * de fichier est tout aussi absurde) et AVANT le verdict des vignettes.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import type { BoundsByType, RawBounds } from "./segmentChapters";

/** Une intro qui commence passé cette part du média n'en est pas une. */
export const INTRO_MAX_START_RATIO = 0.5;

/** Applique la garde, en place. Durée inconnue : on ne juge rien. */
export function applyClaimGuards(bounds: BoundsByType, runtimeMs: number): void {
  if (runtimeMs <= 0) return;
  const intros = bounds.get("Intro");
  if (!intros || intros.length === 0) return;

  const kept: RawBounds[] = intros.filter(
    (intro) => intro.startMs <= runtimeMs * INTRO_MAX_START_RATIO,
  );
  if (kept.length === intros.length) return;
  if (kept.length > 0) bounds.set("Intro", kept);
  else bounds.delete("Intro");
}
