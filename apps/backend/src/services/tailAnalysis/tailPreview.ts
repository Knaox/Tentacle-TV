/**
 * L'APERÇU du prochain épisode — de la parole après le générique qui n'est
 * jamais une scène.
 *
 * Les animés japonais closent presque tous leurs épisodes de la même façon :
 * l'ending chanté (une minute et demie d'images et de crédits, en musique), puis
 * l'aperçu de l'épisode suivant — une voix off sur des extraits, jusqu'au bout du
 * fichier, au carton de copyright près. Pour l'analyse, c'est de la parole après
 * le générique : une « scène post-générique ». Le premier détecteur la proposait
 * comme telle sur dix épisodes de One Piece sur douze, et sur « Bleach »,
 * « Fullmetal Alchemist », « Fire Force »… — le bouton menait à l'aperçu. Et à
 * l'époque sans ending de One Piece, un marqueur Jellyfin s'arrêtait juste avant
 * lui : même bouton, même aperçu.
 *
 * Mesuré sur 35 aperçus et 23 vraies scènes finales d'épisodes (banc du
 * 28.09.2026) :
 *  - un aperçu dure 4 à 35 s et s'arrête à moins de 15 s de la dernière image ;
 *  - ce qui le précède n'est presque jamais une suite de cartons sur noir (un
 *    tiers des vignettes au plus) : l'ending est fait d'IMAGES, ou c'est un
 *    carton « To be continued » de trois secondes ;
 *  - la scène finale d'une série occidentale, elle, suit des cartons sur noir
 *    (« Rick et Morty » : trois vignettes sur trois) ; et la partie C d'un animé
 *    dure plus de 40 s (« Spy x Family », « Jujutsu Kaisen »).
 *
 * Le prix connu : un omake court COLLÉ à l'aperçu (le « Taisho Secret » de
 * « Demon Slayer », 34 s de gag puis 4 s d'annonce) se lit comme lui.
 */

import { count, type Timeline } from "./tailTimeline";

const PREVIEW_MIN_MS = 4_000;
const PREVIEW_MAX_MS = 40_000;
/** Un carton de copyright ou d'avertissement peut suivre l'aperçu. */
const END_SLACK_MS = 20_000;
/** Une respiration de la voix off (un effet, le titre chanté) ne coupe pas l'aperçu. */
const VOICE_GAP_MS = 3_000;
/** Juste avant la voix, l'ending : au moins ça de musique, lu sur la minute et demie d'avant… */
const ENDING_MIN_MS = 40_000;
const ENDING_LOOK_MS = 90_000;
/** … où l'on ne parle presque pas : quelques syllabes chantées, jamais une réplique suivie. */
const ENDING_SPEECH_MAX = 0.3;
const ENDING_SPEECH_RUN_MAX_MS = 8_000;
/** … fait d'images, pas d'une suite de cartons sur noir (un défilement occidental). */
const ENDING_CARDS_MAX = 0.5;
/** Un marqueur qui s'arrête à ça de la voix finale la précède… */
const MARKER_SLACK_MS = 10_000;
/** … et ne couvre presque aucun carton sur noir (une vignette sombre texturée n'en est pas un). */
const MARKER_CARDS_MAX = 0.2;
/** L'aperçu ancré sur un marqueur : 30 à 35 s de voix et un carton de copyright au plus. */
const ANCHORED_MAX_MS = 45_000;
const ANCHORED_SPEECH_MIN = 0.6;

/**
 * L'aperçu qui clôt un épisode, [début, fin), ou `null`. `fromMs` borne la
 * recherche : le début du générique.
 *
 * Ce qui le précède compte autant que lui : une voix courte au bout du fichier,
 * c'est aussi la fin d'un gag de « Rick et Morty » coupé par un interlude musical
 * (S1E10). L'aperçu, lui, suit l'ENDING — une longue plage musicale d'images.
 */
export function findPreview(t: Timeline, fromMs: number): [number, number] | null {
  const voice = finalVoice(t, fromMs);
  if (voice === null) return null;
  const [first, last] = voice;
  // L'ending : la minute et demie d'avant, en musique — une chanson peut glisser
  // quelques secondes « parlées » (« L'attaque des Titans » S4E20), pas une réplique.
  const ending = Math.max(fromMs, first - ENDING_LOOK_MS);
  if (first - ending < ENDING_MIN_MS) return null;
  if (t.share(ending, first, "S") > ENDING_SPEECH_MAX || longestSpeech(t, ending, first) > ENDING_SPEECH_RUN_MAX_MS) return null;
  const cells = t.cellsBetween(ending, first);
  if (cells.length === 0 || count(cells, "TC") / cells.length > ENDING_CARDS_MAX) return null;
  return [first, last];
}

/**
 * L'aperçu d'un épisode SANS ending (One Piece, d'Enies Lobby à Wano : l'histoire, un
 * carton « To be continued » de trois secondes, l'aperçu) : rien ne le précède qu'on
 * puisse lire, mais un marqueur de fournisseur s'arrête juste avant lui — ou en son
 * milieu —, et ce marqueur ne couvre aucun carton sur noir (ceux-là précèdent les vraies
 * scènes finales des séries occidentales).
 */
export function findPreviewAfterMarker(t: Timeline, fromMs: number): { preview: [number, number]; markerEndMs: number } | null {
  if (t.input.episode !== true || !t.hasAudio) return null;
  const markers = t.input.providerSpans.filter((s) => cardShare(t, s.startMs, s.endMs) <= MARKER_CARDS_MAX);
  const voice = finalVoice(t, fromMs);
  if (voice !== null) {
    const [first, last] = voice;
    const marker = markers.find((s) => s.endMs >= first - MARKER_SLACK_MS && s.endMs <= last);
    if (marker) return { preview: [first, last], markerEndMs: marker.endMs };
  }
  // La voix de l'aperçu enchaîne sans un silence sur les dialogues de l'épisode : c'est
  // le marqueur qui la borne — son début s'il est court (le carton « To be continued »),
  // sa fin sinon. Derrière lui, jusqu'à la dernière image : de la voix, pas plus de 45 s.
  const end = t.knownEndMs;
  for (const s of markers) {
    if (s.endMs < end - ANCHORED_MAX_MS || s.endMs > end - PREVIEW_MIN_MS) continue;
    if (t.share(s.endMs, end, "S") < ANCHORED_SPEECH_MIN) continue;
    const first = s.endMs - s.startMs <= ANCHORED_MAX_MS ? s.startMs : s.endMs;
    return { preview: [first, end], markerEndMs: s.endMs };
  }
  return null;
}

function cardShare(t: Timeline, from: number, to: number): number {
  const cells = t.cellsBetween(from, to);
  return cells.length > 0 ? count(cells, "TC") / cells.length : 0;
}

/** La voix courte qui clôt un épisode, [début, fin), ou `null`. */
function finalVoice(t: Timeline, fromMs: number): [number, number] | null {
  if (t.input.episode !== true || !t.hasAudio) return null;
  const end = t.knownEndMs;
  let last = end - 1000;
  while (last >= end - END_SLACK_MS && t.sound(last) !== "S") last -= 1000;
  if (last < end - END_SLACK_MS || last < fromMs) return null;
  let first = last;
  let gap = 0;
  for (let s = last - 1000; s >= fromMs; s -= 1000) {
    if (t.sound(s) === "S") {
      first = s;
      gap = 0;
    } else if (++gap * 1000 > VOICE_GAP_MS) {
      break;
    }
  }
  const duration = last + 1000 - first;
  return duration < PREVIEW_MIN_MS || duration > PREVIEW_MAX_MS ? null : [first, last + 1000];
}

/** La plus longue réplique de [from, to), en ms. */
function longestSpeech(t: Timeline, from: number, to: number): number {
  let best = 0;
  let run = 0;
  for (let s = from; s < to; s += 1000) {
    run = t.sound(s) === "S" ? run + 1000 : 0;
    best = Math.max(best, run);
  }
  return best;
}
