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
import { lireEdr } from "./macosEdr";
import { capturerFenetre, type StatistiquesImage } from "./macosCapture";
import { getProperty } from "./mpv";
import type { VideoSurface } from "./surface";

export interface SondeSurface {
  /** Géométrie des deux fenêtres, en une ligne. */
  geometrie: string;
  numeroFenetre: number;
  /** Plage étendue accordée en ce moment, et ce que l'écran saurait donner. */
  edr: { courant: number; potentiel: number };
  image: StatistiquesImage | null;
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
const SEUIL_IMAGE = 0.35;

/** Un aplat n'a pas de relief, et une image en a toujours. */
const SEUIL_ECART_TYPE = 4;

function verdictImage(image: StatistiquesImage | null, erreur: string | null): string {
  if (erreur !== null) return `INDETERMINE — ${erreur}`;
  if (image === null) return "INDETERMINE — aucune fenetre video";
  const pct = (image.nonNoirs * 100).toFixed(1);
  const detail = `${pct} % non noirs, ecart-type ${image.ecartType.toFixed(1)}, ${String(image.teintes)} teintes`;
  const vue = image.nonNoirs >= SEUIL_IMAGE && image.ecartType >= SEUIL_ECART_TYPE;
  return `${vue ? "IMAGE VISIBLE" : "RIEN A VOIR"} — ${detail}`;
}

/**
 * Interroge les trois couches. Ne lève jamais : une sonde qui tombe n'apprend
 * rien, et elle tourne pendant une lecture.
 */
export async function sonder(surface: VideoSurface | null): Promise<SondeSurface> {
  const numero = surface?.numeroFenetre?.() ?? 0;
  const etat = lireEdr(surface?.fenetreVideo?.() ?? null);

  let image: StatistiquesImage | null = null;
  let erreur: string | null = null;
  if (numero === 0) {
    erreur = "la fenetre video n'existe pas";
  } else {
    try {
      image = await capturerFenetre(numero);
    } catch (e) {
      erreur = String(e instanceof Error ? e.message : e);
    }
  }

  return {
    geometrie: surface?.geometrie?.() ?? "surface non attachee",
    numeroFenetre: numero,
    edr: { courant: etat.courant, potentiel: etat.potentiel },
    image,
    erreur,
    verdict: verdictImage(image, erreur),
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
async function chaineCouleur(): Promise<string> {
  const [gamma, prim, sortieGamma, sortiePrim, hwdec, vo, perdues] = await Promise.all([
    getProperty("video-params/gamma"),
    getProperty("video-params/primaries"),
    getProperty("video-target-params/gamma"),
    getProperty("video-target-params/primaries"),
    getProperty("hwdec-current"),
    getProperty("current-vo"),
    getProperty("frame-drop-count"),
  ]);
  const ou = (v: string | null): string => v ?? "?";
  return (
    `contenu ${ou(gamma)}/${ou(prim)} → sortie ${ou(sortieGamma)}/${ou(sortiePrim)}` +
    ` · ${ou(hwdec)} · ${ou(vo)} · ${ou(perdues)} perdue(s)`
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
export async function tracerRapport(surface: VideoSurface | null): Promise<void> {
  const [s, couleur] = await Promise.all([sonder(surface), chaineCouleur()]);
  const edr = `${s.edr.courant.toFixed(2)} / ${s.edr.potentiel.toFixed(2)}`;
  trace(`RAPPORT — ${s.verdict}`);
  trace(`RAPPORT — EDR ${edr}${s.edr.courant > 1.01 ? " (plage etendue ACCORDEE)" : ""}`);
  trace(`RAPPORT — ${couleur}`);
  trace(`RAPPORT — fenetre ${String(s.numeroFenetre)} · ${s.geometrie}`);
}
