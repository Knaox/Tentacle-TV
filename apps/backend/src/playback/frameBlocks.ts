/**
 * Les PASSAGES homogènes d'une suite de vignettes, et leur lissage.
 *
 * Extrait de `creditsFromFrames.ts`, qui passait les 300 lignes. Rien n'a
 * changé en chemin : ce fichier ne décide pas ce qu'est un générique, il
 * découpe une suite de mesures en tranches de même nature et absorbe les
 * images isolées. Le verdict, lui, reste chez son voisin.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

/** Ce qu'on mesure sur une vignette. Rien de plus : deux nombres suffisent. */
export interface FrameSample {
  /** Position de la vignette dans le média, en millisecondes. */
  ms: number;
  /** Part de pixels quasi noirs, de 0 à 1. */
  dark: number;
  /** Saturation moyenne (écart max-min des canaux), de 0 à 255. */
  saturation: number;
}

/**
 * Les deux seuils qui séparent un générique d'une scène.
 *
 * Ils viennent des relevés de l'en-tête, et ils sont VOLONTAIREMENT larges : le
 * lissage fait le reste du travail, et un seuil serré rejetterait les génériques
 * illustrés — ceux de Marvel commencent souvent par un montage en couleur.
 */
export const DARK_MIN = 0.72;
export const SATURATION_MAX = 18;

/**
 * Le NOYAU : la saturation d'un défilement de texte sur fond noir.
 *
 * Relevé 0,0 à 0,5 sur les quatre films ; la scène sombre la plus terne du
 * corpus est à 4,8. Trois est au milieu, et du bon côté des deux.
 */
export const CORE_SATURATION_MAX = 3;
/** Durée minimale de ce noyau — jamais plus que le plancher d'un générique. */
export const MIN_CORE_MS = 30_000;

/**
 * En deçà, un passage n'existe pas : c'est une image isolée.
 *
 * Trente secondes, soit trois vignettes à la cadence habituelle. C'est aussi le
 * plancher de ce qui mérite d'être appelé une scène — en dessous, proposer un
 * saut vers « la suite » enverrait le spectateur sur un fondu.
 */
export const MIN_BLOCK_MS = 30_000;

export interface Block {
  credits: boolean;
  startMs: number;
  /** Fin EXCLUSIVE — la position de la vignette suivante, ou la fin du média. */
  endMs: number;
}

/** Le classement LARGE : ce qui pourrait être un générique. */
export function looksLikeCredits(sample: FrameSample): boolean {
  return sample.dark >= DARK_MIN && sample.saturation <= SATURATION_MAX;
}

/** Le classement du NOYAU : du texte qui défile sur du noir, et rien d'autre. */
export function isCore(sample: FrameSample): boolean {
  return sample.dark >= DARK_MIN && sample.saturation <= CORE_SATURATION_MAX;
}

/** Découpe la suite en passages homogènes, sans encore rien lisser. */
export function toBlocks(
  samples: readonly FrameSample[],
  runtimeMs: number,
  classify: (sample: FrameSample) => boolean,
): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const credits = classify(sample);
    // La vignette vaut jusqu'à la suivante ; la dernière, jusqu'à la fin du média.
    const endMs = i + 1 < samples.length ? samples[i + 1].ms : runtimeMs;
    const last = blocks[blocks.length - 1];
    if (last && last.credits === credits) last.endMs = endMs;
    else blocks.push({ credits, startMs: sample.ms, endMs });
  }
  return blocks;
}

/**
 * Absorbe les passages trop courts dans leur voisin, jusqu'à stabilité.
 *
 * Un passage court est rendu à son PRÉDÉCESSEUR — sauf le premier, qui n'en a
 * pas et rejoint son successeur. La boucle recommence tant qu'elle a fusionné :
 * absorber un passage peut en laisser un autre trop court à côté.
 */
export function smooth(blocks: Block[]): Block[] {
  let current = blocks;
  for (;;) {
    if (current.length <= 1) return current;
    const index = current.findIndex((b) => b.endMs - b.startMs < MIN_BLOCK_MS);
    if (index < 0) return current;

    const next: Block[] = [];
    for (let i = 0; i < current.length; i++) {
      if (i === index) continue;
      next.push({ ...current[i] });
    }
    // La classe de l'absorbé disparaît : ses bornes rejoignent le voisin retenu.
    const host = index === 0 ? next[0] : next[index - 1];
    if (index === 0) host.startMs = current[0].startMs;
    else host.endMs = current[index].endMs;

    // Deux voisins de même classe redeviennent un seul passage.
    const merged: Block[] = [];
    for (const block of next) {
      const last = merged[merged.length - 1];
      if (last && last.credits === block.credits) last.endMs = block.endMs;
      else merged.push(block);
    }
    current = merged;
  }
}
