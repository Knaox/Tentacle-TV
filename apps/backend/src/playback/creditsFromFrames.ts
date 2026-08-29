/**
 * Le générique de fin lu dans les VIGNETTES — et la scène qui vit dedans.
 *
 * # Pourquoi ce module existe
 *
 * Aucun fournisseur de segments ne sait où le générique s'ARRÊTE : mesuré le
 * 29.08 sur une instance 10.11.8 portant les quatre greffons, `EndTicks` valait
 * exactement `RunTimeTicks` sur tous les films examinés (voir l'en-tête de
 * `segmentChapters.ts`). Pire, quand le détecteur ne trouve pas le début du
 * générique il rend la QUEUE du fichier : sur « Spider-Man : No Way Home »,
 * Jellyfin ne signale qu'un Outro de 46 secondes à 147:25 sur 148:11 — écarté
 * comme non crédible, donc rien du tout n'est proposé au spectateur.
 *
 * Les chapitres nommés sauvent les fichiers qui en portent (`segmentChapters.ts`),
 * et ils gardent la priorité. Ce module s'occupe des autres.
 *
 * # Ce qu'il regarde
 *
 * Les vignettes de la barre de progression, que le serveur a DÉJÀ fabriquées :
 * une image toutes les dix secondes. Un générique, c'est du texte clair sur du
 * noir — beaucoup de pixels noirs, presque aucune couleur. Une scène, c'est
 * l'inverse. Relevé sur le film ci-dessus :
 *
 *   138:40 → 146:00   noir 78 à 100 %, saturation 0,0      le générique
 *   146:10 → 147:50   noir 0 à 65 %,   saturation 8 à 104  la scène post-générique
 *
 * et sur « Deadpool & Wolverine », dont le générique est pourtant illustré :
 *
 *   119:40 → 126:50   (Jellyfin dit 119:49 — dix secondes, soit une vignette)
 *   126:50 → 127:40   la scène (le chapitre du disque la place à 126:47)
 *
 * # Le lissage, sans lequel ce serait faux
 *
 * Trois pièges MESURÉS, tous absorbés par la même règle : un passage de moins de
 * trente secondes n'existe pas. Deux images colorées isolées dans le générique
 * de « Deadpool & Wolverine » (121:20 et 122:10), deux images claires dans celui
 * de « No Way Home » (142:20 et 142:30, du texte blanc), et une image NOIRE au
 * milieu de la scène post-générique (146:40, une coupe).
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import { POST_CREDITS_MIN_MS, POST_CREDITS_THRESHOLD_MS, minCredibleOutroMs } from "./segmentTypes";
import type { BoundsByType, RawBounds } from "./segmentChapters";

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
const DARK_MIN = 0.72;
const SATURATION_MAX = 18;

/**
 * En deçà, un passage n'existe pas : c'est une image isolée.
 *
 * Trente secondes, soit trois vignettes à la cadence habituelle. C'est aussi le
 * plancher de ce qui mérite d'être appelé une scène — en dessous, proposer un
 * saut vers « la suite » enverrait le spectateur sur un fondu.
 */
const MIN_BLOCK_MS = 30_000;

/** Ce que les vignettes savent dire du générique de fin. */
export interface FrameVerdict {
  /** Le générique. Sa fin est le début de la scène quand il y en a une. */
  outro: RawBounds;
  /** Une scène vit après ce générique — c'est ce qui sauve les post-génériques. */
  sceneAfter: boolean;
}

interface Block {
  credits: boolean;
  startMs: number;
  /** Fin EXCLUSIVE — la position de la vignette suivante, ou la fin du média. */
  endMs: number;
}

/** Découpe la suite en passages homogènes, sans encore rien lisser. */
function toBlocks(samples: readonly FrameSample[], runtimeMs: number): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const credits = sample.dark >= DARK_MIN && sample.saturation <= SATURATION_MAX;
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
function smooth(blocks: Block[]): Block[] {
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

/**
 * Le verdict, ou `null` quand les vignettes ne disent rien de sûr.
 *
 * `null` est la réponse par DÉFAUT, et c'est voulu : sans générique crédible on
 * ne fabrique rien. Un bouton posé au hasard sur la dernière scène coûte plus
 * cher que pas de bouton du tout.
 */
export function creditsFromFrames(
  samples: readonly FrameSample[],
  runtimeMs: number,
): FrameVerdict | null {
  if (runtimeMs <= 0 || samples.length === 0) return null;
  // Les vignettes au-delà de la durée sont du remplissage noir (mesuré) : les
  // garder ferait passer la queue du fichier pour un générique.
  const kept = [...samples].filter((s) => s.ms >= 0 && s.ms < runtimeMs).sort((a, b) => a.ms - b.ms);
  if (kept.length === 0) return null;

  const blocks = smooth(toBlocks(kept, runtimeMs));
  const floor = minCredibleOutroMs(runtimeMs);

  // Le PREMIER générique crédible de la seconde moitié : c'est celui qui sépare
  // le film de sa fin. Ceux d'après — un générique final après une scène — sont
  // trop courts pour compter, et de toute façon on ne propose qu'un saut.
  const index = blocks.findIndex(
    (b) => b.credits && b.endMs - b.startMs >= floor && b.startMs >= runtimeMs / 2,
  );
  if (index < 0) return null;

  const outro = blocks[index];
  const after = blocks[index + 1];
  // Une scène ne compte que si elle dure, et si elle ne touche pas la fin du
  // fichier de si près qu'il n'y aurait rien à voir.
  const scene =
    after !== undefined &&
    !after.credits &&
    after.endMs - after.startMs >= POST_CREDITS_MIN_MS &&
    runtimeMs - after.startMs >= POST_CREDITS_MIN_MS;

  return {
    outro: {
      startMs: outro.startMs,
      endMs: scene ? outro.endMs : runtimeMs,
      source: "frames",
    },
    sceneAfter: scene,
  };
}

/**
 * Verse le verdict dans les bornes déjà résolues — sans jamais gêner ce qui
 * marche.
 *
 * Trois cas, et c'est toute la règle :
 *
 *  1. **un générique crédible qui ne finit PAS à la fin du fichier** — un
 *     chapitre nommé l'a donné, ou un greffon l'a bien vu : on ne touche à rien ;
 *  2. **un générique qui finit à la fin du fichier** — on ne corrige QUE sa fin,
 *     et seulement pour révéler une scène. Son début reste celui du fournisseur,
 *     qui l'a mesuré sur la vidéo et non sur une vignette ;
 *  3. **aucun générique** — le verdict en fournit un.
 *
 * Les autres types ne sont jamais touchés : intro, résumé et aperçu marchent.
 */
export function applyFrameVerdict(
  bounds: BoundsByType,
  verdict: FrameVerdict | null,
  runtimeMs: number,
): void {
  if (verdict === null) return;
  const existing = bounds.get("Outro");
  if (!existing || existing.length === 0) {
    bounds.set("Outro", [verdict.outro]);
    return;
  }
  if (!verdict.sceneAfter) return;

  const last = existing[existing.length - 1];
  const endsAtMediaEnd = runtimeMs > 0 && last.endMs >= runtimeMs - POST_CREDITS_THRESHOLD_MS;
  if (!endsAtMediaEnd) return;
  // La scène doit être APRÈS ce que le fournisseur a signalé, et laisser de quoi
  // regarder : sinon on raccourcirait un générique pour rien.
  if (verdict.outro.endMs <= last.startMs) return;
  if (runtimeMs - verdict.outro.endMs < POST_CREDITS_MIN_MS) return;
  last.endMs = verdict.outro.endMs;
}
