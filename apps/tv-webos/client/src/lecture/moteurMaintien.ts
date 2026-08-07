import { PALIERS } from "./machineScrub";

/**
 * Le maintien d'une flèche, et sa montée en vitesse.
 *
 * **Le débit ne doit pas dépendre de la dalle.** La version précédente avançait
 * d'un pas à chaque répétition clavier et montait d'un palier tous les six
 * appuis. Or la cadence d'auto-répétition d'un téléviseur LG n'est ni
 * documentée ni constante d'un modèle à l'autre : le même maintien couvrait
 * deux minutes ici, six là. L'Apple TV n'a pas ce problème parce qu'elle ne
 * compte pas les répétitions — elle tient son propre tic de 250 ms, et le
 * palier monte d'un cran par seconde. C'est ce modèle qui est transposé ici.
 *
 * Les répétitions ne servent donc plus qu'à deux choses : prouver que la touche
 * est toujours enfoncée, et mesurer l'intervalle du modèle.
 *
 * **Pourquoi on mesure ce que l'Apple TV peut supposer.** `keyup` n'est pas
 * garanti sur toutes les dalles — c'est le constat que partagent déjà
 * `appuiLong.ts` et `verrouTouche.ts`, qui en déduisent le relâchement d'un
 * silence de 700 ms. Reprendre tel quel le seuil de 350 ms de l'Apple TV
 * casserait le maintien sur une dalle dont la répétition est plus lente que
 * cela ; garder 700 ms laisserait le curseur filer près de trois tics après le
 * relâchement. On part donc de 700 ms, et on resserre dès que deux répétitions
 * ont donné l'intervalle réel — sans jamais descendre sous les 350 ms de
 * l'Apple TV, ni monter au-dessus des 700 ms du reste du portage.
 *
 * Module pur : horloge et minuteurs viennent de l'appelant en test.
 */

/** La cadence du tic. Celle d'`apps/tv`, et elle ne dépend de rien. */
export const TIC_MAINTIEN_MS = 250;

/** Un palier par seconde de maintien — 1×, 2×, 4×, 8×. */
export const MS_PAR_PALIER = 1000;

/** Le silence tant qu'on n'a pas mesuré la dalle. Valeur du reste du portage. */
export const SILENCE_DEFAUT_MS = 700;

/** Le plancher, repris d'`apps/tv` : en deçà, une répétition normale ferait rupture. */
export const SILENCE_MINIMAL_MS = 350;

/** De combien d'intervalles un silence doit dépasser pour valoir relâchement. */
const FACTEUR_SILENCE = 2.5;

/** Sous cette valeur, l'intervalle mesuré relève du rebond, pas de la répétition. */
const INTERVALLE_MINIMAL_MS = 60;

export interface OptionsMoteurMaintien {
  /** Un pas d'avance : appui simple comme tic de maintien. */
  avancer: (sens: 1 | -1, palier: number) => void;
  /** Horloge, injectable pour les tests. */
  maintenant?: () => number;
}

export interface MoteurMaintien {
  /** Un `keydown` directionnel. Le premier avance d'un pas, les suivants tiennent. */
  appuyer: (code: number, sens: 1 | -1) => void;
  /** Un `keyup`, quand la dalle en émet. */
  relacher: () => void;
  detruire: () => void;
}

export function creerMoteurMaintien(options: OptionsMoteurMaintien): MoteurMaintien {
  const horloge = options.maintenant ?? (() => Date.now());

  let dernierCode = 0;
  let dernierInstant = 0;
  let sensCourant: 1 | -1 = 1;

  /** Instant d'engagement du maintien, ou `null` tant qu'on est en appui simple. */
  let debutMaintien: number | null = null;
  let intervalle = 0;
  let tic: ReturnType<typeof setInterval> | null = null;
  let veille: ReturnType<typeof setTimeout> | null = null;

  function seuilSilence(): number {
    if (intervalle <= 0) return SILENCE_DEFAUT_MS;
    const mesure = Math.round(intervalle * FACTEUR_SILENCE);
    return Math.min(SILENCE_DEFAUT_MS, Math.max(SILENCE_MINIMAL_MS, mesure));
  }

  function palier(): number {
    if (debutMaintien === null) return PALIERS[0];
    const tenu = horloge() - debutMaintien;
    const rang = Math.min(Math.floor(tenu / MS_PAR_PALIER), PALIERS.length - 1);
    return PALIERS[Math.max(0, rang)];
  }

  function armerVeille(): void {
    if (veille !== null) clearTimeout(veille);
    veille = setTimeout(arreterMaintien, seuilSilence());
  }

  function arreterMaintien(): void {
    if (tic !== null) {
      clearInterval(tic);
      tic = null;
    }
    if (veille !== null) {
      clearTimeout(veille);
      veille = null;
    }
    debutMaintien = null;
  }

  function engager(instant: number): void {
    debutMaintien = instant;
    // Le tic possède l'avance à partir d'ici : les répétitions qui suivent ne
    // font plus que tenir la veille. C'est ce qui rend le débit indépendant de
    // la cadence de la dalle.
    tic = setInterval(() => options.avancer(sensCourant, palier()), TIC_MAINTIEN_MS);
  }

  function appuyer(code: number, sens: 1 | -1): void {
    const instant = horloge();
    const enchaine =
      code === dernierCode && sens === sensCourant && instant - dernierInstant <= seuilSilence();

    if (!enchaine) {
      // Nouvel appui : un pas fixe, sans accélération. C'est la seule façon de
      // viser une position précise, et c'est ce que fait `stepScrub` d'`apps/tv`.
      arreterMaintien();
      intervalle = 0;
      dernierCode = code;
      sensCourant = sens;
      dernierInstant = instant;
      options.avancer(sens, PALIERS[0]);
      return;
    }

    const mesure = instant - dernierInstant;
    if (mesure >= INTERVALLE_MINIMAL_MS) {
      intervalle = intervalle > 0 ? Math.min(intervalle, mesure) : mesure;
    }
    dernierInstant = instant;

    if (debutMaintien === null) engager(instant);
    armerVeille();
  }

  function relacher(): void {
    arreterMaintien();
    dernierCode = 0;
    dernierInstant = 0;
    intervalle = 0;
  }

  return {
    appuyer,
    relacher,
    detruire: arreterMaintien,
  };
}
