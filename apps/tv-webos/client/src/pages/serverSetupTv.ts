import { UnavailableScreen } from "./unavailableScreen";

/**
 * L'assistant d'installation du serveur, sur un téléviseur : l'écran
 * « Indisponible ».
 *
 * Substitué à `apps/web/src/pages/ServerSetup.tsx`, sa seule porte d'entrée.
 * `App.tsx` le monte tant que le serveur n'est pas installé — une dalle n'y
 * arrive que face à un serveur neuf ou remis à zéro. L'installation se fait au
 * clavier, de près : des champs, un mot de passe, des dossiers à parcourir. Le
 * texte de l'écran renvoie déjà vers un ordinateur, un téléphone ou une
 * tablette.
 *
 * Substituer la PORTE, et non l'assistant, sort tout son graphe du bundle :
 * son import paresseux y laissait une cinquantaine de modules, environ 180 Ko
 * par fragment (moderne et legacy, mesuré le 2026-10-13), que la dalle ne
 * chargeait jamais.
 */
export const ServerSetup = UnavailableScreen;
