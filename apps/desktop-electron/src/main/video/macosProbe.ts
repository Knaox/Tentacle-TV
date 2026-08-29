/**
 * La sonde de surface macOS : ce que l'écran montre VRAIMENT.
 *
 * # Ce qu'elle répond, et que rien d'autre ne répond
 *
 * Le panneau de diagnostic lit les propriétés de mpv, et elles disent tout —
 * sauf la seule chose qui compte : est-ce qu'on VOIT quelque chose ? Le montage
 * macOS empile une fenêtre native de mpv, une surface Chromium transparente
 * par-dessus, et un compositeur qui accorde ou non de la plage étendue. Chacune
 * des trois couches peut échouer seule, en silence, sans qu'aucune propriété ne
 * bouge d'un iota. Le symptôme est alors toujours le même — le son sort,
 * l'image reste noire — et il a coûté toute la phase 1.
 *
 * Trois mesures, trois couches :
 *
 *  - la GÉOMÉTRIE dit si la fenêtre vidéo est calée sur notre rectangle de
 *    contenu, si elle est bien fille de la nôtre, si elle est visible ;
 *  - l'EDR dit si le compositeur accorde de la plage étendue — demander et
 *    obtenir sont deux choses (voir `macosEdr.ts`) ;
 *  - les PIXELS disent s'il y a une image (voir `macosCapture.ts`).
 *
 * ⚠️ **Développement uniquement** : la capture lance un exécutable du système.
 */

import { trace } from "./native";
import { readEdr } from "./macosEdr";
import { captureWindow, type ImageStats } from "./macosCapture";
import { getProperty } from "./mpv";
import type { VideoSurface } from "./surface";

export interface SurfaceProbe {
  /** Géométrie des deux fenêtres, en une ligne. */
  geometrie: string;
  numeroFenetre: number;
  /** Plage étendue accordée en ce moment, et ce que l'écran saurait donner. */
  edr: { courant: number; potentiel: number };
  image: ImageStats | null;
  /** Motif de l'absence d'image : autorisation, fenêtre absente, échec. */
  erreur: string | null;
  /** Verdict en clair, celui qu'on lit en premier. */
  verdict: string;
}

/**
 * En dessous, il n'y a pas d'image.
 *
 * Le proto donnait 74 à 92 % sur du contenu réel — la borne basse étant un film
 * en scope, dont les bandes noires occupent le quart du cadre. Un écran noir
 * tombe sous les 15 %. Le seuil est placé entre les deux, plus près du bas :
 * mieux vaut un doute qu'un faux succès.
 */
const IMAGE_THRESHOLD = 0.35;

/** Un aplat n'a pas de relief, et une image en a toujours. */
const STDDEV_THRESHOLD = 4;

function imageVerdict(image: ImageStats | null, error: string | null): string {
  if (error !== null) return `INDETERMINE — ${error}`;
  if (image === null) return "INDETERMINE — aucune fenetre video";
  const pct = (image.nonNoirs * 100).toFixed(1);
  const detail = `${pct} % non noirs, ecart-type ${image.ecartType.toFixed(1)}, ${String(image.teintes)} teintes`;
  const seen = image.nonNoirs >= IMAGE_THRESHOLD && image.ecartType >= STDDEV_THRESHOLD;
  return `${seen ? "IMAGE VISIBLE" : "RIEN A VOIR"} — ${detail}`;
}

/**
 * Interroge les trois couches. Ne lève jamais : une sonde qui tombe n'apprend
 * rien, et elle tourne pendant une lecture.
 */
export async function probe(surface: VideoSurface | null): Promise<SurfaceProbe> {
  const number = surface?.numeroFenetre?.() ?? 0;
  const state = readEdr(surface?.videoWindow?.() ?? null);

  let image: ImageStats | null = null;
  let error: string | null = null;
  if (number === 0) {
    error = "la fenetre video n'existe pas";
  } else {
    try {
      image = await captureWindow(number);
    } catch (e) {
      error = String(e instanceof Error ? e.message : e);
    }
  }

  return {
    geometrie: surface?.geometrie?.() ?? "surface non attachee",
    numeroFenetre: number,
    edr: { courant: state.courant, potentiel: state.potentiel },
    image,
    erreur: error,
    verdict: imageVerdict(image, error),
  };
}

/**
 * La chaîne couleur, en une ligne — ce qui explique un EDR resté à 1,00.
 *
 * Trois causes, et elles se corrigent de trois façons opposées : le contenu
 * n'est pas HDR (Jellyfin transcode, et la chaîne est détruite avant que mpv ne
 * la voie), mpv tone-mappe vers du SDR, ou tout est bon et c'est le compositeur
 * qui n'accorde rien. Sans ces valeurs, un EDR à 1,00 ne désigne rien.
 */
async function colourChain(): Promise<string> {
  const [gamma, primaries, outputGamma, outputPrimaries, hwdec, vo, dropped] = await Promise.all([
    getProperty("video-params/gamma"),
    getProperty("video-params/primaries"),
    getProperty("video-target-params/gamma"),
    getProperty("video-target-params/primaries"),
    getProperty("hwdec-current"),
    getProperty("current-vo"),
    getProperty("frame-drop-count"),
  ]);
  const orUnknown = (v: string | null): string => v ?? "?";
  return (
    `contenu ${orUnknown(gamma)}/${orUnknown(primaries)} → sortie ${orUnknown(outputGamma)}/${orUnknown(outputPrimaries)}` +
    ` · ${orUnknown(hwdec)} · ${orUnknown(vo)} · ${orUnknown(dropped)} perdue(s)`
  );
}

/**
 * Le rapport tracé une fois par lecture, en développement.
 *
 * Sans lui, la sonde n'existerait que derrière un raccourci du panneau — donc
 * seulement quand on pense à la demander. Or ce qu'on cherche à voir arrive
 * précisément quand on ne regarde pas : un épisode qui démarre noir, une
 * deuxième lecture calée sur une fenêtre morte. Le journal, lui, garde tout.
 */
export async function traceReport(surface: VideoSurface | null): Promise<void> {
  const [s, colour] = await Promise.all([probe(surface), colourChain()]);
  const edr = `${s.edr.courant.toFixed(2)} / ${s.edr.potentiel.toFixed(2)}`;
  trace(`RAPPORT — ${s.verdict}`);
  // ⚠️ « accordé » n'est PAS « utilisé ». Le système accorde le headroom à qui
  // le DEMANDE — une vue qui a posé `wantsExtendedDynamicRangeOpenGLSurface`
  // obtient le maximum même si elle ne dessine que du SDR. Seule la couche
  // Metal, qui négocie son espace colorimétrique, en fait une preuve.
  trace(`RAPPORT — EDR ${edr}${s.edr.courant > 1.01 ? " (headroom accorde — pas une preuve)" : ""}`);
  trace(`RAPPORT — ${colour}`);
  trace(`RAPPORT — fenetre ${String(s.numeroFenetre)} · ${s.geometrie}`);
}
