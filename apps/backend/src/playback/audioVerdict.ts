/**
 * Ce que l'AUDIO des voisins de saison sait dire d'un épisode — et comment
 * ça se verse dans les bornes.
 *
 * # D'où ça vient
 *
 * Un opening et un ending se répètent d'un épisode à l'autre : leur empreinte
 * audio (chromaprint) est la même dans E2 et dans E3, à un décalage près. Le
 * backend compare la tête et la queue d'un épisode à celles de ses voisins
 * (`services/audioAnalysis.ts`), et ce module reçoit le résultat DÉJÀ jugé :
 * des bornes, ou rien. Mesuré le 19.09.2026 sur Re:Zero S4 et One Piece
 * (Wano, Egghead) : opening et ending retrouvés à ±5 s
 * (`docs/SEGMENTS-LABO-AUDIO.md`).
 *
 * # Ce qu'il fait, et surtout ce qu'il ne fait pas
 *
 * Il ne COMBLE que les types absents. Un fournisseur qui a parlé (API Media
 * Segments, greffon, chapitre nommé) a mesuré sur la vidéo : il garde raison,
 * même quand l'audio n'est pas d'accord. C'est la règle de `fillFromChapters`,
 * pour la même raison : ne pas gêner les médias que Jellyfin détecte bien.
 *
 * Il passe AVANT les gardes de vraisemblance (`claimGuards.ts`) : un opening
 * rejoué sous le générique de fin donne une « intro » à 80 % du fichier, et
 * elle doit tomber sous la même garde que celle d'un greffon — Intro Skipper a
 * produit exactement ce faux positif (Re:Zero S4E4). Et AVANT le verdict des
 * vignettes, qui garde le dernier mot sur la fin d'un générique courant
 * jusqu'au bout du fichier (`applyFrameVerdict`, cas 2).
 *
 * Sans durée connue, aucun Outro n'est posé : la même prudence que les
 * chapitres — trop d'heuristique empilée pour oser un bouton.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import type { BoundsByType, RawBounds } from "./segmentChapters";

/** Le verdict de l'analyse audio d'un épisode, tel qu'il est rangé en base. */
export interface AudioVerdict {
  /** L'opening reconnu dans la tête de l'épisode, ou `null`. */
  intro: RawBounds | null;
  /** Le générique de fin reconnu dans sa queue, ou `null`. */
  outro: RawBounds | null;
  /**
   * Combien de voisins ont confirmé ce qui est posé : 2 = les deux, 1 = un
   * seul était disponible (seuils durcis côté analyse). Sert au journal.
   */
  confirmedBy: number;
  /**
   * Les identifiants des voisins comparés, triés et joints par une virgule.
   * C'est ce qui permet de refaire l'analyse quand la saison a grandi — une
   * série en cours de diffusion n'a qu'un voisin le jour de sa sortie.
   */
  neighbourKey: string;
  /** Pourquoi rien n'a été posé, pour le journal — jamais pour décider. */
  reason?: string;
}

/**
 * Verse le verdict dans les bornes déjà résolues, type par type, seulement là
 * où personne n'a parlé. La source est forcée à `"audio"` : c'est ce que le
 * journal et le diagnostic liront.
 */
export function applyAudioVerdict(
  bounds: BoundsByType,
  verdict: AudioVerdict | null,
  runtimeMs: number,
): void {
  if (verdict === null) return;
  if (verdict.intro !== null && !hasBounds(bounds, "Intro")) {
    bounds.set("Intro", [{ ...verdict.intro, source: "audio" }]);
  }
  if (verdict.outro !== null && runtimeMs > 0 && !hasBounds(bounds, "Outro")) {
    bounds.set("Outro", [{ ...verdict.outro, source: "audio" }]);
  }
}

function hasBounds(bounds: BoundsByType, type: "Intro" | "Outro"): boolean {
  const list = bounds.get(type);
  return list !== undefined && list.length > 0;
}
