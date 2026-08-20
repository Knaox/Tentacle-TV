import { CLES_REGLAGE_APPAREIL, creerMagasinBooleen } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur a le droit de faire à la fin d'un épisode — navigateur,
 * ordinateur et téléviseur LG, qui partagent ce code.
 *
 * # Deux réglages, deux portées
 *
 * **La carte « à suivre »** est la petite fiche du coin, proposée pendant le
 * générique. L'éteindre laisse la fin de l'épisode nue. L'AFFICHE PLEIN ÉCRAN
 * du tout dernier instant n'est pas concernée : ce n'est ni la même surface ni
 * le même moment.
 *
 * Éteindre la carte éteint aussi l'enchaînement PENDANT LE GÉNÉRIQUE, et ce
 * n'est pas un effet de bord : la carte est la seule surface de ce moment-là.
 * La laisser éteinte pendant qu'un décompte court reviendrait à sauter à
 * l'épisode suivant vers quatre-vingt-dix pour cent sans rien afficher, donc
 * sans rien qu'on puisse annuler.
 *
 * **Le compte à rebours** gouverne l'enchaînement AUTOMATIQUE, sur les deux
 * surfaces. Éteint, la carte et l'affiche restent affichées — mais comme de
 * simples propositions, sans chiffre ni barre de progression, et plus rien ne
 * démarre tant qu'on n'a pas appuyé sur Lecture.
 *
 * # Portée
 *
 * Par appareil, comme le saut d'intro et la bascule HDR : ces automatismes se
 * décident devant l'écran. Le stockage local répond de surcroît HORS LIGNE, là
 * où une préférence serveur laisserait le lecteur sans réponse au moment précis
 * où il doit décider — et l'enchaînement d'un épisode téléchargé emprunte
 * exactement les mêmes chemins.
 *
 * Clés, défauts et mécanique viennent de `@tentacle-tv/shared` : les
 * téléviseurs natifs lisent la même chose.
 */

const stockageNavigateur = {
  getItem: (cle: string) => localStorage.getItem(cle),
  setItem: (cle: string, valeur: string) => localStorage.setItem(cle, valeur),
};

export const magasinCarteASuivre = creerMagasinBooleen(
  stockageNavigateur,
  CLES_REGLAGE_APPAREIL.carteASuivre,
);

export const magasinDecompteEnchainement = creerMagasinBooleen(
  stockageNavigateur,
  CLES_REGLAGE_APPAREIL.decompteEnchainement,
);
