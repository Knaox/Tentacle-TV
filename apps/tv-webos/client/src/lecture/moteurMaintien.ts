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

/**
 * Au-delà de cet écart, deux appuis sont deux GESTES, pas une répétition.
 *
 * Le seuil de silence (350–700 ms) dit quand un maintien s'ARRÊTE ; il ne dit
 * pas ce qui l'a commencé, et il servait pourtant aux deux. Or on tape
 * volontiers deux fois sur la même flèche en trois cents millisecondes : le
 * second appui tombait sous le seuil, passait pour une auto-répétition, et
 * lançait le tic. Deux sauts demandés, une avance rapide obtenue.
 */
const INTERVALLE_REPETITION_MS = 450;

/**
 * Combien de répétitions consécutives avant que le tic prenne la main.
 *
 * Le seul plafond ne suffisait pas : une dalle dont l'auto-répétition tourne à
 * quatre cents millisecondes — le module rappelle plus haut que cette cadence
 * n'est ni documentée ni constante d'un modèle à l'autre — ne l'aurait jamais
 * franchi, et l'avance rapide y aurait purement disparu. Ce qui distingue
 * vraiment une dalle d'un doigt n'est pas la vitesse, c'est l'INSISTANCE.
 *
 * Deux répétitions suffisent : un doigt qui tape deux fois produit un seul
 * enchaînement et garde ses deux sauts, une touche tenue en produit autant
 * qu'on veut. Taper trois fois de suite déclenchera l'avance rapide — c'est
 * assumé : à ce stade, c'est bien ce qu'on demande.
 */
export const REPETITIONS_AVANT_TIC = 2;

export interface OptionsMoteurMaintien {
  /** Un pas d'avance : appui simple comme tic de maintien. */
  avancer: (sens: 1 | -1, palier: number) => void;
  /** Horloge, injectable pour les tests. */
  maintenant?: () => number;
}

export interface MoteurMaintien {
  /** Un `keydown` directionnel. Le premier avance d'un pas, les suivants tiennent. */
  appuyer: (code: number, sens: 1 | -1) => void;
  /**
   * Un `keyup`, quand la dalle en émet — et SEULEMENT celui de la touche tenue.
   *
   * Le relâchement était jusqu'ici aveugle au code : le `keyup` d'OK, de Retour
   * ou de n'importe quelle autre touche coupait un maintien de flèche encore
   * enfoncée. Deux touches se croisent plus souvent qu'on ne croit — la Magic
   * Remote a un bouton central, et l'on tient volontiers une flèche en cliquant.
   */
  relacher: (code: number) => void;
  /**
   * Rupture franche, sans passer par un code : le mode du lecteur a changé.
   *
   * Un maintien ne traverse pas une frontière de mode. Sans cela, une flèche
   * tenue pendant que l'habillage s'éteint reprenait de l'autre côté comme un
   * appui neuf — et un tic survivant à une confirmation de déplacement
   * ressuscitait le déplacement qu'on venait de valider.
   */
  annuler: () => void;
  detruire: () => void;
}

export function creerMoteurMaintien(options: OptionsMoteurMaintien): MoteurMaintien {
  const horloge = options.maintenant ?? (() => Date.now());

  let dernierCode = 0;
  let dernierInstant = 0;
  let sensCourant: 1 | -1 = 1;

  /** Répétitions consécutives de la même touche, remis à zéro à chaque geste. */
  let repetitions = 0;

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
    // Ce qui qualifie une répétition est la CADENCE, pas le silence. Le seuil
    // de silence dit quand un maintien s'arrête ; s'en servir aussi pour dire
    // ce qui l'a commencé faisait passer deux appuis distincts pour un
    // maintien, et deux sauts pour une avance rapide.
    const enchaine =
      code === dernierCode &&
      sens === sensCourant &&
      instant - dernierInstant <= INTERVALLE_REPETITION_MS;

    if (!enchaine) {
      // Nouvel appui : un pas fixe, sans accélération. C'est la seule façon de
      // viser une position précise, et c'est ce que fait `stepScrub` d'`apps/tv`.
      arreterMaintien();
      intervalle = 0;
      repetitions = 0;
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
    repetitions += 1;

    if (debutMaintien === null) {
      // Tant que le tic n'a pas pris la main, chaque événement vaut un pas :
      // sans cela, les répétitions qui précèdent l'engagement n'avanceraient
      // de rien et un double appui ne produirait qu'un seul saut.
      options.avancer(sens, PALIERS[0]);
      if (repetitions >= REPETITIONS_AVANT_TIC) engager(instant);
    }
    armerVeille();
  }

  function annuler(): void {
    arreterMaintien();
    dernierCode = 0;
    dernierInstant = 0;
    intervalle = 0;
    repetitions = 0;
  }

  function relacher(code: number): void {
    // Aucun maintien en cours, ou le `keyup` d'une autre touche : on ne touche
    // à rien. `dernierCode` vaut zéro tant que rien n'est tenu, et aucun code
    // de touche ne vaut zéro.
    if (code !== dernierCode) return;
    annuler();
  }

  return {
    appuyer,
    relacher,
    annuler,
    detruire: arreterMaintien,
  };
}
