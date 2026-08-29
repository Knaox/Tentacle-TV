/**
 * Ce que les CHAPITRES d'un fichier savent des passages — et ce qu'ils ne
 * savent pas.
 *
 * Deux services, très différents l'un de l'autre :
 *
 *  1. **combler** un Intro ou un Outro qu'aucun fournisseur n'a signalé, à
 *     partir d'un chapitre NOMMÉ (« End Credits », « Générique de fin ») ;
 *  2. **affiner la fin d'un Outro**, et c'est le service qui sauve les scènes
 *     post-génériques.
 *
 * # Pourquoi le second existe
 *
 * Aucun fournisseur de segments ne sait où le générique s'ARRÊTE. Mesuré le
 * 29.08 sur une instance 10.11.8 portant les quatre greffons (Chapter
 * Segments, Intro Skipper, SkipMe.db, TheIntroDB) : sur tous les films
 * examinés, `EndTicks` valait exactement `RunTimeTicks`. Les détecteurs
 * trouvent le DÉBUT du générique — une rupture d'images noires — puis étendent
 * jusqu'au bout du fichier. Une scène post-générique disparaît donc dans le
 * segment censé la précéder.
 *
 * Les chapitres, eux, la connaissent quand le disque en porte de vrais :
 * « Deadpool & Wolverine » a un Outro 119:49 → 127:55 et un chapitre qui
 * commence à 126:47 — la scène. C'est cette borne-là qu'on va chercher.
 *
 * # Le garde-fou, sans lequel ce serait pire que rien
 *
 * Beaucoup d'encodages portent des chapitres AUTO-GÉNÉRÉS, posés toutes les
 * cinq ou dix minutes. L'un d'eux tombe forcément au milieu du générique, et
 * l'affinage y verrait une scène qui n'existe pas — il enverrait alors le
 * spectateur en plein milieu du défilement. On rejette donc tout jeu de
 * chapitres régulièrement espacé : un découpage de disque ne l'est jamais.
 *
 * MIROIR : reflété octet pour octet dans `apps/backend/src/playback/` (voir
 * l'en-tête de `segmentTypes.ts`) — n'importer que la paire.
 */

import { POST_CREDITS_MIN_MS, TICKS_PER_MS, type SegmentType } from "./segmentTypes";

/** Chapitre Jellyfin — le champ `Chapters` du DTO de l'item. */
export interface ChapterMarker {
  StartPositionTicks: number;
  Name: string;
}

/** Les bornes brutes d'un passage, avant assainissement. */
export interface RawBounds {
  startMs: number;
  endMs: number;
  source: "jellyfin" | "chapters";
}

export type BoundsByType = Map<SegmentType, RawBounds>;

// Un chapitre d'ouverture d'abord : « Opening Credits » ou « Générique de
// début » contiennent aussi un mot du motif de fin — l'intro se teste en
// premier et un chapitre reconnu comme intro ne peut pas être un générique.
const CHAPTER_INTRO_PATTERN =
  /(\bintro\b|\bintroduction\b|\bopening\b|g[ée]n[ée]rique\s+de\s+d[ée]but)/i;
const CHAPTER_OUTRO_PATTERN =
  /(end\s*credits|\bcredits?\b|\boutro\b|\bending\b|g[ée]n[ée]rique(?!\s+de\s+d[ée]but))/i;

/**
 * Un chapitre qui commence si près du début du générique n'est pas une scène :
 * c'est le chapitre DU générique, décalé de quelques secondes.
 */
const STINGER_MARGIN_MS = 60_000;

/** En deçà, deux jeux de chapitres ne se distinguent pas — on ne conclut rien. */
const MIN_CHAPTERS_FOR_SPACING_TEST = 4;

/** Écart toléré entre le plus grand et le plus petit intervalle, en proportion. */
const REGULAR_SPACING_TOLERANCE = 0.05;

/**
 * Comble Intro et Outro manquants depuis les chapitres nommés. Fin d'un
 * chapitre = début du suivant ; pour un générique en dernier chapitre, la fin
 * est la durée du média — le « +120 s » deviné de l'ancienne normalisation
 * disparaît. Sans durée connue, aucun Outro de chapitre n'est posé (trop
 * d'heuristique empilée pour oser un bouton).
 */
export function fillFromChapters(
  bounds: BoundsByType,
  chapters: readonly ChapterMarker[] | null | undefined,
  runtimeMs: number,
): void {
  if (!chapters || chapters.length < 2) return;

  let outro: RawBounds | null = null;
  for (let i = 0; i < chapters.length; i++) {
    const name = chapters[i].Name;
    const startMs = chapters[i].StartPositionTicks / TICKS_PER_MS;
    const nextStartMs =
      i + 1 < chapters.length ? chapters[i + 1].StartPositionTicks / TICKS_PER_MS : null;

    if (CHAPTER_INTRO_PATTERN.test(name)) {
      if (!bounds.has("Intro") && nextStartMs !== null) {
        bounds.set("Intro", { startMs, endMs: nextStartMs, source: "chapters" });
      }
      continue;
    }
    if (runtimeMs > 0 && CHAPTER_OUTRO_PATTERN.test(name)) {
      // Le DERNIER chapitre correspondant l'emporte — c'est lui, le générique
      // de fin (comportement historique conservé).
      outro = { startMs, endMs: nextStartMs ?? runtimeMs, source: "chapters" };
    }
  }
  if (outro && !bounds.has("Outro")) bounds.set("Outro", outro);
}

/**
 * Les débuts de chapitre exploitables, en ms — `null` quand le découpage est
 * régulier, donc auto-généré, donc muet sur le contenu.
 */
export function meaningfulChapterStarts(
  chapters: readonly ChapterMarker[] | null | undefined,
): number[] | null {
  if (!chapters || chapters.length < 2) return null;
  const starts = chapters
    .map((chapter) => chapter.StartPositionTicks / TICKS_PER_MS)
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .sort((a, b) => a - b);
  if (starts.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) gaps.push(starts[i] - starts[i - 1]);
  if (gaps.length >= MIN_CHAPTERS_FOR_SPACING_TEST - 1) {
    const shortest = Math.min(...gaps);
    const longest = Math.max(...gaps);
    // Des intervalles quasi identiques = une découpe posée à la machine.
    if (longest > 0 && (longest - shortest) / longest <= REGULAR_SPACING_TOLERANCE) return null;
  }
  return starts;
}

/**
 * Ramène la fin d'un Outro au début de la scène qui le suit, quand un chapitre
 * la désigne. Ne fait RIEN si le segment laisse déjà de la place après lui
 * (un fournisseur a déjà tranché) ou si les chapitres ne prouvent rien.
 */
export function refineOutroWithChapters(
  bounds: BoundsByType,
  chapters: readonly ChapterMarker[] | null | undefined,
  runtimeMs: number,
): void {
  const outro = bounds.get("Outro");
  if (!outro || runtimeMs <= 0) return;
  if (runtimeMs - outro.endMs >= POST_CREDITS_MIN_MS) return;

  const starts = meaningfulChapterStarts(chapters);
  if (!starts) return;

  // La PREMIÈRE marque à l'intérieur : sur un film à deux scènes (mi-générique
  // puis post-générique), c'est celle-là qu'on veut rejoindre.
  const stinger = starts.find(
    (ms) => ms >= outro.startMs + STINGER_MARGIN_MS && ms <= runtimeMs - POST_CREDITS_MIN_MS,
  );
  if (stinger !== undefined) outro.endMs = stinger;
}
