/**
 * Des zones communes au VERDICT — les règles, et leurs raisons mesurées.
 *
 * # Ce qu'une zone doit être pour devenir un passage
 *
 *  - un opening vit dans les TÊTES, un ending dans les QUEUES ; jamais de
 *    croisement tête ↔ queue : le récap rejoue la queue du précédent, l'aperçu
 *    la tête du suivant ;
 *  - assez long pour n'être ni un eyecatch ni un jingle (15 s), pas trop pour
 *    n'être ni un doublon ni une chanson d'insert (150 s pour un opening,
 *    300 s pour un ending) ; une zone qui couvre plus de la moitié de la
 *    fenêtre est le MÊME fichier — le voisin est écarté ;
 *  - l'ending est la DERNIÈRE zone crédible de la queue (Re:Zero S4E4 : rejoué
 *    à 81 %, puis trois minutes d'épilogue) ; ce qui reste après lui, s'il y en
 *    a moins de 45 s, est un aperçu ou une carte de copyright, et le générique
 *    est étendu jusqu'au bout ; s'il y en a plus, c'est du contenu, et il faut
 *    que les DEUX voisins l'aient entendu ;
 *  - les marges vont dans le sens sûr : arriver une seconde tôt coûte une
 *    seconde d'opening, arriver tard ampute une scène.
 *
 * # Le témoignage des voisins
 *
 * Deux voisins qui entendent tous deux le passage doivent être d'accord (fins
 * à 15 s, durées à 3 s) ; sinon, silence — c'est le cas d'un opening qui change
 * en milieu de saison. Un seul voisin qui l'entend (l'autre n'a pas d'opening,
 * ou n'existe pas) est accepté avec des seuils durcis : 25 s, densité 0,8.
 * Un faux positif serait SAUTÉ automatiquement avec les réglages par défaut :
 * le silence est la règle, le bouton l'exception.
 */

import type { AudioVerdict } from "../playback/audioVerdict";
import type { RawBounds } from "../playback/segmentChapters";
import { minCredibleOutroMs } from "../playback/segmentTypes";
import type { MatchZone } from "./audioMatch";

export const AUDIO_MATCH_MIN_MS = 15_000;
export const AUDIO_INTRO_MAX_MS = 150_000;
export const AUDIO_OUTRO_MAX_MS = 300_000;
/** Une zone qui couvre plus que ça de la fenêtre : même fichier, voisin écarté. */
export const DUPLICATE_COVERAGE_RATIO = 0.5;
export const INTRO_START_MARGIN_MS = 1_000;
export const INTRO_END_MARGIN_MS = 1_500;
export const OUTRO_START_MARGIN_MS = 2_000;
/** Moins que ça après l'ending : un aperçu, une carte — pas une scène. */
export const TAIL_REMAINDER_MAX_MS = 45_000;
export const NEIGHBOUR_END_AGREEMENT_MS = 15_000;
export const NEIGHBOUR_LENGTH_AGREEMENT_MS = 3_000;
export const SINGLE_NEIGHBOUR_MIN_MS = 25_000;
export const SINGLE_NEIGHBOUR_MIN_DENSITY = 0.8;

export interface Candidate {
  startMs: number;
  endMs: number;
  density: number;
  /** Il reste plus de 45 s de contenu après — une scène, pas un aperçu. */
  contentAfter: boolean;
}

/** Ce qu'UN voisin a dit de l'épisode. */
export interface NeighbourComparison {
  neighbourId: string;
  /** La tête (ou la queue) a-t-elle pu être comparée ? Sans empreinte : non. */
  introCompared: boolean;
  outroCompared: boolean;
  intro: Candidate | null;
  outro: Candidate | null;
  /** Une zone couvrait plus de la moitié d'une fenêtre : même fichier. */
  duplicate: boolean;
}

const length = (zone: MatchZone): number => zone.aEndMs - zone.aStartMs;

export function pickIntro(zones: readonly MatchZone[], windowLengthMs: number): {
  candidate: Candidate | null;
  duplicate: boolean;
} {
  const duplicate = zones.some((z) => length(z) > DUPLICATE_COVERAGE_RATIO * windowLengthMs);
  if (duplicate) return { candidate: null, duplicate };
  const eligible = zones.filter((z) => length(z) >= AUDIO_MATCH_MIN_MS && length(z) <= AUDIO_INTRO_MAX_MS);
  if (eligible.length === 0) return { candidate: null, duplicate: false };
  const best = eligible.reduce((a, b) => (length(b) > length(a) ? b : a));
  return {
    candidate: {
      startMs: best.aStartMs + INTRO_START_MARGIN_MS,
      endMs: best.aEndMs - INTRO_END_MARGIN_MS,
      density: best.density,
      contentAfter: false,
    },
    duplicate: false,
  };
}

export function pickOutro(zones: readonly MatchZone[], windowLengthMs: number, runtimeMs: number): {
  candidate: Candidate | null;
  duplicate: boolean;
} {
  const duplicate = zones.some((z) => length(z) > DUPLICATE_COVERAGE_RATIO * windowLengthMs);
  if (duplicate) return { candidate: null, duplicate };
  const floor = Math.max(AUDIO_MATCH_MIN_MS, minCredibleOutroMs(runtimeMs));
  const eligible = zones.filter((z) => length(z) >= floor && length(z) <= AUDIO_OUTRO_MAX_MS);
  if (eligible.length === 0) return { candidate: null, duplicate: false };
  // La DERNIÈRE : un ending rejoué plus tôt, sous une scène, ne compte pas.
  const last = eligible.reduce((a, b) => (b.aStartMs > a.aStartMs ? b : a));
  const remainder = runtimeMs - last.aEndMs;
  const contentAfter = remainder >= TAIL_REMAINDER_MAX_MS;
  return {
    candidate: {
      startMs: last.aStartMs + OUTRO_START_MARGIN_MS,
      endMs: contentAfter ? last.aEndMs : runtimeMs,
      density: last.density,
      contentAfter,
    },
    duplicate: false,
  };
}

interface Agreed {
  bounds: RawBounds | null;
  confirmedBy: number;
  reason: string | null;
}

const agree = (a: Candidate, b: Candidate): boolean =>
  Math.abs(a.endMs - b.endMs) <= NEIGHBOUR_END_AGREEMENT_MS &&
  Math.abs(a.endMs - a.startMs - (b.endMs - b.startMs)) <= NEIGHBOUR_LENGTH_AGREEMENT_MS;

const longer = (a: Candidate, b: Candidate): Candidate =>
  b.endMs - b.startMs > a.endMs - a.startMs ? b : a;

const toBounds = (c: Candidate): RawBounds => ({ startMs: c.startMs, endMs: c.endMs, source: "audio" });

/** Le verdict d'UN type, d'après ce que chaque voisin en a dit. */
export function settle(
  label: "intro" | "ending",
  candidates: readonly Candidate[],
  compared: number,
): Agreed {
  if (compared === 0) return { bounds: null, confirmedBy: 0, reason: `${label} : aucun voisin comparé` };
  if (candidates.length === 0) return { bounds: null, confirmedBy: 0, reason: `${label} : rien de partagé` };
  if (candidates.length >= 2) {
    const [a, b] = candidates;
    if (!agree(a, b)) return { bounds: null, confirmedBy: 0, reason: `${label} : voisins en désaccord` };
    return { bounds: toBounds(longer(a, b)), confirmedBy: 2, reason: null };
  }
  const only = candidates[0];
  if (only.contentAfter) {
    return { bounds: null, confirmedBy: 0, reason: `${label} : du contenu après, un seul voisin` };
  }
  if (only.endMs - only.startMs < SINGLE_NEIGHBOUR_MIN_MS || only.density < SINGLE_NEIGHBOUR_MIN_DENSITY) {
    return { bounds: null, confirmedBy: 0, reason: `${label} : un seul voisin, trop faible` };
  }
  return { bounds: toBounds(only), confirmedBy: 1, reason: null };
}

/** Le verdict de l'épisode, d'après ses voisins. Toujours un objet : le « rien » se garde. */
export function combineComparisons(
  comparisons: readonly NeighbourComparison[],
  neighbourKey: string,
): AudioVerdict {
  const kept = comparisons.filter((c) => !c.duplicate);
  const intro = settle(
    "intro",
    kept.filter((c) => c.intro !== null).map((c) => c.intro as Candidate),
    kept.filter((c) => c.introCompared).length,
  );
  const outro = settle(
    "ending",
    kept.filter((c) => c.outro !== null).map((c) => c.outro as Candidate),
    kept.filter((c) => c.outroCompared).length,
  );
  const posed = [intro, outro].filter((s) => s.bounds !== null);
  const confirmedBy = posed.length === 0 ? 0 : Math.min(...posed.map((s) => s.confirmedBy));
  const reasons = [intro.reason, outro.reason].filter((r): r is string => r !== null);
  const dropped = comparisons.length - kept.length;
  if (dropped > 0) reasons.push(`${String(dropped)} voisin(s) écarté(s) : même fichier`);
  return {
    intro: intro.bounds,
    outro: outro.bounds,
    confirmedBy,
    neighbourKey,
    ...(reasons.length > 0 ? { reason: reasons.join(" ; ") } : {}),
  };
}
