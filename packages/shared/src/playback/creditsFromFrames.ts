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
 * # ⚠️ Le noir ne suffit PAS, et c'est la leçon d'un premier essai raté
 *
 * « Sombre et peu coloré » désigne aussi les scènes de nuit — et sur ces
 * mêmes films, elles durent des minutes. Le premier montage prenait la bataille
 * nocturne de « No Way Home » (89 → 94 min, noir 90 %, saturation 8) pour le
 * générique, et proposait de passer le troisième acte.
 *
 * Ce qui sépare vraiment les deux, mesuré sur quatre films : **tout vrai
 * générique porte une plage à saturation quasi NULLE** — le défilement du texte,
 * relevé entre 0,0 et 0,5 sur les quatre. Aucune scène sombre n'y descend : le
 * minimum observé est 4,8 (« Deadpool & Wolverine », 67 → 76 min).
 *
 * D'où deux classements superposés : un LARGE, qui donne l'étendue du générique
 * (il doit accepter les génériques illustrés, dont les premières minutes sont en
 * couleur), et un NOYAU, strict, sans lequel un passage large n'est pas retenu.
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
import {
  MIN_BLOCK_MS,
  MIN_CORE_MS,
  isCore,
  looksLikeCredits,
  smooth,
  toBlocks,
  type Block,
  type FrameSample,
} from "./frameBlocks";
import { hasSceneEvidence, salvageTailStinger } from "./sceneChecks";

export type { FrameSample } from "./frameBlocks";
import type { BoundsByType, RawBounds } from "./segmentChapters";

/** Ce que les vignettes savent dire du générique de fin. */
export interface FrameVerdict {
  /**
   * Le générique. Quand une scène suit, sa fin est la DERNIÈRE vignette de
   * générique — un pas de grille AVANT la première vignette de scène : la
   * vraie transition vit quelque part dans cet intervalle, et sauter sur la
   * vignette de scène, c'était arriver jusqu'à dix secondes APRÈS le début
   * (rapporté 3 à 5 s en pratique). Arriver un peu tôt coûte quelques
   * secondes de générique ; arriver tard ampute la scène.
   */
  outro: RawBounds;
  /** Une scène vit après ce générique — c'est ce qui sauve les post-génériques. */
  sceneAfter: boolean;
  /**
   * Le générique FINAL, celui qui reprend APRÈS la scène et court jusqu'au bout
   * du fichier. `null` quand la scène est la dernière chose du média.
   *
   * C'est le modèle de Plex, que le résolveur connaît déjà : générique, scène
   * post-générique, générique final. Sans lui, la scène finie, le spectateur
   * restait devant des minutes de défilement sans rien pour en sortir — le
   * bouton avait fait son office et s'était tu.
   */
  finalCredits: RawBounds | null;
}

/** Le pas de grille présumé quand rien ne permet de le mesurer (défaut Jellyfin). */
const FALLBACK_INTERVAL_MS = 10_000;

/**
 * L'écart médian entre deux vignettes gardées — le pas de la grille.
 *
 * Repli quand l'appelant ne connaît pas l'intervalle du manifeste : les
 * échantillons vivent sur la grille `frame × Interval`, la médiane des écarts
 * la retrouve donc exactement, même avec des planches manquantes au milieu.
 */
function medianGapMs(kept: readonly FrameSample[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < kept.length; i++) {
    const gap = kept[i].ms - kept[i - 1].ms;
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return FALLBACK_INTERVAL_MS;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
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
  intervalMs?: number,
): FrameVerdict | null {
  if (runtimeMs <= 0 || samples.length === 0) return null;
  // Les vignettes au-delà de la durée sont du remplissage noir (mesuré) : les
  // garder ferait passer la queue du fichier pour un générique.
  const kept = [...samples].filter((s) => s.ms >= 0 && s.ms < runtimeMs).sort((a, b) => a.ms - b.ms);
  if (kept.length === 0) return null;
  const step = intervalMs !== undefined && intervalMs > 0 ? intervalMs : medianGapMs(kept);

  const blocks = smooth(toBlocks(kept, runtimeMs, looksLikeCredits));
  const floor = minCredibleOutroMs(runtimeMs);
  // Jamais plus de noyau que le plancher d'un générique : un épisode de vingt
  // minutes a droit à un générique de treize secondes, noyau compris.
  const coreFloor = Math.min(MIN_CORE_MS, floor);
  const cores = smooth(toBlocks(kept, runtimeMs, isCore)).filter(
    (b) => b.credits && b.endMs - b.startMs >= coreFloor,
  );

  // Le PLUS LONG passage crédible qui porte un noyau. Le plus long, et non le
  // dernier : une queue de fichier noire assez longue pour survivre au lissage
  // serait un candidat parfait, et elle ne dure jamais ce que dure un générique.
  let index = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b.credits || b.endMs - b.startMs < floor || b.startMs < runtimeMs / 2) continue;
    if (!cores.some((core) => core.startMs >= b.startMs && core.endMs <= b.endMs)) continue;
    if (index < 0 || b.endMs - b.startMs > blocks[index].endMs - blocks[index].startMs) index = i;
  }
  if (index < 0) return null;

  const outro = blocks[index];
  // Un passage clair SANS preuve de scène n'est pas une scène : le défilement
  // dense d'« Avatar » (colonnes multiples, part de noir 0,62) passait le
  // classement large et offrait trois minutes de « scène » en plein générique
  // (cf. `sceneChecks.ts`). Le faux passage et le générique qui le suit
  // rejoignent l'enveloppe, et on réexamine le passage d'après — une VRAIE
  // scène derrière un faux clair reste trouvable.
  let sceneIndex = index + 1;
  while (
    blocks[sceneIndex] !== undefined &&
    !blocks[sceneIndex].credits &&
    !hasSceneEvidence(kept, blocks[sceneIndex].startMs, blocks[sceneIndex].endMs)
  ) {
    sceneIndex += 2;
  }
  const after = blocks[sceneIndex];
  // Une scène ne compte que si elle dure, et si elle ne touche pas la fin du
  // fichier de si près qu'il n'y aurait rien à voir.
  const scene =
    after !== undefined &&
    !after.credits &&
    after.endMs - after.startMs >= POST_CREDITS_MIN_MS &&
    runtimeMs - after.startMs >= POST_CREDITS_MIN_MS;

  // Un pas de grille en arrière : on atterrit sur la DERNIÈRE vignette du
  // générique, jamais après le début de la scène (voir `FrameVerdict`). Le
  // garde-fou borne un pas absurde — la borne ne remonte pas sous le début.
  let endMs = scene ? Math.max(after.startMs - step, outro.startMs + 1_000) : runtimeMs;
  let sceneAfter = scene;
  // Générique jusqu'au bout : dernière chance au stinger DE FIN DE FICHIER,
  // trop sombre pour survivre au lissage (« Iron Man » — cf. `sceneChecks.ts`).
  if (!sceneAfter && endMs >= runtimeMs) {
    const salvaged = salvageTailStinger(kept, runtimeMs);
    if (salvaged !== null && salvaged.sceneStartMs > outro.startMs) {
      endMs = Math.max(salvaged.sceneStartMs - step, outro.startMs + 1_000);
      sceneAfter = true;
    }
  }

  return {
    outro: { startMs: outro.startMs, endMs, source: "frames" },
    sceneAfter,
    // Le générique FINAL ne suit qu'une scène vue en BLOCS : un stinger
    // repêché court jusqu'au bout du fichier, rien ne reprend derrière lui.
    finalCredits: scene ? finalCreditsAfter(blocks, index, runtimeMs) : null,
  };
}

/**
 * Le générique qui REPREND après la scène, s'il y en a un.
 *
 * On prend le DERNIER passage de la suite : c'est celui qui touche la fin du
 * fichier, et c'est le seul qui mérite un bouton « Terminer la lecture ». Il
 * doit être un générique, commencer après la scène, et durer assez pour qu'un
 * bouton ne fasse pas que clignoter.
 *
 * Son début ne recule PAS d'un pas de grille, à dessein : le sens de sécurité
 * est inverse — en avance, « Terminer la lecture » paraîtrait sur les
 * dernières secondes de la scène ; en retard d'une vignette, il ne coûte rien.
 */
function finalCreditsAfter(blocks: Block[], index: number, runtimeMs: number): RawBounds | null {
  const last = blocks[blocks.length - 1];
  if (last === undefined || blocks.length < index + 3) return null;
  if (!last.credits) return null;
  if (last.endMs - last.startMs < MIN_BLOCK_MS) return null;
  return { startMs: last.startMs, endMs: runtimeMs, source: "frames" };
}

/**
 * Verse le verdict dans les bornes déjà résolues — sans jamais gêner ce qui
 * marche.
 *
 * Quatre cas, et c'est toute la règle :
 *
 *  1. **un générique crédible qui ne finit PAS à la fin du fichier** — un
 *     chapitre nommé l'a donné, ou un greffon l'a bien vu : on ne touche à rien ;
 *  2. **un générique qui finit à la fin du fichier et qui CHEVAUCHE le nôtre** —
 *     on ne corrige QUE sa fin, et seulement pour révéler une scène. Son début
 *     reste celui du fournisseur, qui l'a mesuré sur la vidéo, pas sur une
 *     vignette ;
 *  3. **un marqueur qui commence APRÈS la fin du générique qu'on a vu** — il ne
 *     décrit pas le générique mais la queue du fichier, et il se REMPLACE.
 *     Mesuré sur « No Way Home » : Jellyfin y pose un « générique » de 46
 *     secondes à 147:25 sur 148:09, quarante minutes après le vrai. Il survit au
 *     filtre de crédibilité d'une seconde, et le bouton propose alors de
 *     terminer le film — juste avant la scène post-générique ;
 *  4. **aucun générique** — le verdict en fournit un.
 *
 * Dans tous les cas où l'on écrit, le générique FINAL suit s'il existe : c'est
 * lui qui donne le bouton « Terminer la lecture » une fois la scène passée.
 *
 * Les autres types ne sont jamais touchés : intro, résumé et aperçu marchent.
 */
export function applyFrameVerdict(
  bounds: BoundsByType,
  verdict: FrameVerdict | null,
  runtimeMs: number,
): void {
  if (verdict === null) return;
  // Le générique FINAL voyage avec le principal : c'est lui qui donnera le
  // bouton « Terminer la lecture » une fois la scène passée.
  const withFinal = (main: RawBounds): RawBounds[] =>
    verdict.finalCredits !== null && verdict.finalCredits.startMs >= main.endMs
      ? [main, verdict.finalCredits]
      : [main];

  const existing = bounds.get("Outro");
  if (!existing || existing.length === 0) {
    bounds.set("Outro", withFinal(verdict.outro));
    return;
  }

  const last = existing[existing.length - 1];
  const endsAtMediaEnd = runtimeMs > 0 && last.endMs >= runtimeMs - POST_CREDITS_THRESHOLD_MS;
  if (!endsAtMediaEnd) return;

  // Cas 3 : le marqueur commence après la fin de CE QU'ON A VU. Il ne décrit pas
  // le générique. On ne remplace toutefois que par plus long : un verdict plus
  // court qu'un marqueur qu'on ne comprend pas ne vaut pas mieux que lui.
  if (verdict.outro.endMs <= last.startMs) {
    const seen = verdict.outro.endMs - verdict.outro.startMs;
    if (seen > last.endMs - last.startMs) bounds.set("Outro", withFinal(verdict.outro));
    return;
  }

  // Cas 2 : la fin seule, et seulement pour révéler une scène qui vaut le geste.
  if (!verdict.sceneAfter) return;
  if (runtimeMs - verdict.outro.endMs < POST_CREDITS_MIN_MS) return;
  last.endMs = verdict.outro.endMs;
  // Le fournisseur n'a signalé qu'un marqueur ; le générique final, lui, vient
  // des vignettes. On ne l'ajoute que si le fournisseur n'en avait pas déjà un.
  if (existing.length === 1) bounds.set("Outro", withFinal(last));
}
