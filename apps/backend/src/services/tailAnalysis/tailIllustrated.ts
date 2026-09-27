/**
 * Le générique ILLUSTRÉ qui ouvre la fin d'un film, suivi d'une scène
 * mi-générique — le motif le plus courant des films à scènes.
 *
 * Marvel, Pixar, Sony, Illumination : le film finit, puis une ou deux minutes de
 * générique « conçu » (dessins, animations, photos, montage, noms en grand), puis
 * la scène mi-générique, puis le défilement. Les vignettes ne voient pas ce
 * générique-là : ses images sont des IMAGES, et ses noms, souvent petits ou
 * brefs, manquent la vignette de dix secondes (« Fast X », « Super Mario
 * Galaxy » : pas une rangée de texte en deux minutes). Le premier détecteur
 * posait donc le générique au défilement, APRÈS la scène : elle se jouait
 * d'elle-même au bout de deux minutes de générique sans bouton — dix-huit scènes
 * ainsi sur 77 films (« Homecoming », « Captain Marvel », « Far From Home »,
 * « Toy Story 4 »…).
 *
 * C'est le SON qui le signale : 79 % de ses vignettes sont en musique, contre
 * 11 % des scènes. Mais la fin d'un film l'est souvent aussi (19 % des vignettes
 * des quatre dernières minutes) : remonter le générique à travers la musique,
 * sans autre preuve, l'aurait posé dans le film six fois sur vingt-cinq
 * (« Interstellar », « Avatar 2 », « Shrek 2 »…). La preuve, c'est la SCÈNE :
 * une plage parlée, collée au défilement (ou aux cartons qui le précèdent),
 * précédée d'au moins une minute de musique. Sur le banc, ce motif-là n'est
 * jamais la fin d'un film.
 *
 * On ne rend que le début de ce générique ; la scène, elle, est trouvée par la
 * lecture ordinaire de la parole (`tailScenes.ts`), qui la voit dès lors qu'elle
 * tombe après le début du générique.
 */

import { isCredits, type Timeline } from "./tailTimeline";

/** On ne remonte pas plus loin que le générique d'avant le défilement le plus long mesuré. */
const LOOKBACK_MS = 360_000;
/** La scène : parlée d'un bout à l'autre, de vingt secondes à cinq minutes. */
const SCENE_MIN_MS = 20_000;
const SCENE_MAX_MS = 300_000;
const SCENE_SPEECH_MIN = 0.5;
/** Le générique illustré : au moins une minute de musique, sans parole. */
const MUSIC_MIN_MS = 60_000;
const MUSIC_SHARE_MIN = 0.6;
const MUSIC_SPEECH_MAX = 0.3;
/** Une vignette mêlée (un effet, une réplique sur la chanson) ne coupe pas le bloc. */
const MIXED_SPEECH_MAX = 0.5;

export interface IllustratedCredits {
  /** Le début du générique illustré. */
  startMs: number;
  /** Le début de la scène parlée qui le suit (en vignettes : ±10 s). */
  sceneMs: number;
}

/** Le générique illustré qui précède une scène collée au défilement, ou `null`. */
export function illustratedCredits(t: Timeline, crawlStart: number): IllustratedCredits | null {
  if (!t.hasAudio) return null;
  const step = t.step;
  const limit = Math.max(crawlStart - LOOKBACK_MS, t.firstCellMs);
  // Les cartons et le noir muets entre la scène et le défilement en font partie.
  let sceneEnd = crawlStart;
  while (sceneEnd - step >= limit) {
    const c = t.cell(sceneEnd - step);
    if (!(isCredits(c) || c === "K") || t.share(sceneEnd - step, sceneEnd, "S") >= SCENE_SPEECH_MIN) break;
    sceneEnd -= step;
  }
  let sceneStart = sceneEnd;
  while (sceneStart - step >= limit && "EDK".includes(t.cell(sceneStart - step)) && t.share(sceneStart - step, sceneStart, "S") >= SCENE_SPEECH_MIN) {
    sceneStart -= step;
  }
  const scene = sceneEnd - sceneStart;
  if (scene < SCENE_MIN_MS || scene > SCENE_MAX_MS) return null;
  let start = sceneStart;
  let mixed = 1;
  while (start - step >= limit) {
    const from = start - step;
    const speech = t.share(from, start, "S");
    const musical = t.share(from, start, "M") >= MUSIC_SHARE_MIN && speech <= MUSIC_SPEECH_MAX;
    const card = (isCredits(t.cell(from)) || t.cell(from) === "K") && speech <= MUSIC_SPEECH_MAX;
    if (musical || card) {
      start = from;
      continue;
    }
    // Une seule vignette mêlée, et seulement si la musique reprend derrière elle.
    const before = from - step;
    const resumes = before >= limit && t.share(before, from, "M") >= MUSIC_SHARE_MIN && t.share(before, from, "S") <= MUSIC_SPEECH_MAX;
    if (mixed > 0 && speech < MIXED_SPEECH_MAX && resumes) {
      mixed--;
      start = from;
      continue;
    }
    break;
  }
  if (sceneStart - start < MUSIC_MIN_MS) return null;
  // La dernière réplique du film peut mordre sur la première vignette : on part après elle.
  let first = start;
  for (let s = start; s < start + step; s += 1000) if (t.sound(s) === "S") first = s + 1000;
  return { startMs: first, sceneMs: sceneStart };
}
