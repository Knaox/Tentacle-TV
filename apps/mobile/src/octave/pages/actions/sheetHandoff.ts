/**
 * Octave mobile — passer d'une feuille à la suivante (menu d'un titre → « Ajouter à une playlist », « Gérer »
 * → « Renommer »…) : refermer la première, puis ouvrir la suivante une fois la première VRAIMENT retirée
 * (`whenNoModal`, le portier des modales). Un délai fixe ne tenait pas : la sortie d'une feuille dure
 * jusqu'à 600 ms, et iOS ne présente jamais une modale pendant qu'une autre se retire — la seconde feuille
 * ne paraissait pas. Une nouvelle passe demandée entre-temps annule la précédente.
 */

import { whenNoModal } from "../../../components/ui/modalGate";

let request = 0;

export function handOffSheet(close: () => void, open: () => void): void {
  const mine = ++request;
  close();
  whenNoModal(() => {
    if (mine === request) open();
  });
}
