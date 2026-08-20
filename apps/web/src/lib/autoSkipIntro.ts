import { CLES_REGLAGE_APPAREIL, creerMagasinBooleen } from "@tentacle-tv/shared";

/**
 * Préférence « sauter l'intro toute seule » — réglage PAR APPAREIL, comme la
 * bascule HDR et le Liquid Glass.
 *
 * Par appareil et non par compte : sauter l'intro se décide devant l'écran, pas
 * dans un profil. On la veut sur le téléviseur du salon qu'on enchaîne le soir,
 * rarement sur le portable où l'on reprend une série de loin en loin. Le
 * stockage local a aussi l'avantage de répondre hors ligne, là où une
 * préférence serveur laisserait le lecteur sans réponse.
 *
 * ALLUMÉE par défaut. On enchaîne les épisodes le soir, et revoir trois fois le
 * même générique en une heure n'a jamais été le but ; le saut reste annulable
 * au cas par cas — trois secondes et une croix. Clé, défaut et mécanique
 * viennent de `@tentacle-tv/shared`, que les téléviseurs natifs lisent aussi :
 * un seul endroit à changer, pas quatre.
 */

export const AUTO_SKIP_INTRO_STORAGE_KEY = CLES_REGLAGE_APPAREIL.sautIntroAuto;

const magasin = creerMagasinBooleen(
  {
    getItem: (cle) => localStorage.getItem(cle),
    setItem: (cle, valeur) => localStorage.setItem(cle, valeur),
  },
  AUTO_SKIP_INTRO_STORAGE_KEY,
);

export const getAutoSkipIntro = (): boolean => magasin.lireInstantane();

export function setAutoSkipIntro(next: boolean): void {
  magasin.definir(next);
}

export const subscribeAutoSkipIntro = (listener: () => void): (() => void) =>
  magasin.sAbonner(listener);
