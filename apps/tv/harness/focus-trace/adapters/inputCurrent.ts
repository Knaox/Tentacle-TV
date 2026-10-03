import { act } from "react";
import { receiveMenu } from "@bench/input";

/** L'arbre courant : Menu passe par l'entrée unique (`receiveMenu`, comme la portée du Retour et les Modal). */
export function menuPressed(): void {
  act(() => {
    receiveMenu();
  });
}
