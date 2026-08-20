import { useSyncExternalStore } from "react";
import {
  CLES_REGLAGE_APPAREIL,
  creerMagasinBooleen,
  type MagasinBooleen,
  type StockageAppareil,
} from "@tentacle-tv/shared";

/**
 * Ce que le lecteur a le droit de faire à la fin d'un épisode — deux réglages,
 * trois téléviseurs.
 *
 * # Ce que chacun gouverne, et ce qu'il ne gouverne pas
 *
 * **La carte « à suivre »** est la petite fiche du coin, proposée pendant le
 * générique. L'éteindre laisse la fin de l'épisode nue. L'AFFICHE PLEIN ÉCRAN
 * du tout dernier instant n'est pas concernée : ce n'est pas la même surface,
 * ni le même moment — l'une propose la suite pendant qu'il reste des scènes,
 * l'autre est l'écran de fin.
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
 * décident devant l'écran. Le réglage n'empêche pas de SUIVRE un groupe en
 * séance partagée — l'épisode suivant y est décidé par le groupe, et le refus
 * local ne fait que ne plus le déclencher pour les autres.
 */

export const CLE_CARTE_A_SUIVRE = CLES_REGLAGE_APPAREIL.carteASuivre;
export const CLE_DECOMPTE_ENCHAINEMENT = CLES_REGLAGE_APPAREIL.decompteEnchainement;

export type MagasinEnchainement = MagasinBooleen;

export function creerMagasinCarteASuivre(stockage: StockageAppareil): MagasinEnchainement {
  return creerMagasinBooleen(stockage, CLE_CARTE_A_SUIVRE);
}

export function creerMagasinDecompteEnchainement(stockage: StockageAppareil): MagasinEnchainement {
  return creerMagasinBooleen(stockage, CLE_DECOMPTE_ENCHAINEMENT);
}

/** Le hook, lié à un magasin. Chaque cible en fabrique un au démarrage. */
export function creerUseReglageEnchainement(magasin: MagasinEnchainement) {
  return function useReglageEnchainement(): boolean {
    return useSyncExternalStore(magasin.sAbonner, magasin.lireInstantane, magasin.lireInstantane);
  };
}
