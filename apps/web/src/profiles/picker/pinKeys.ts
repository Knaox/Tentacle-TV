/**
 * Ce qu'une touche du clavier fait sur le pavé du code PIN : un chiffre (rangée
 * du haut comme pavé numérique — `event.key` vaut « 7 » dans les deux cas),
 * effacer (Retour arrière, Suppr), revenir (Échap) ; null : la touche ne le
 * concerne pas (Tab, Entrée… gardent leur sens). Module pur.
 */
export type PinKey = "back" | "erase" | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export function pinKeyOf(key: string): PinKey | null {
  if (key.length === 1 && key >= "0" && key <= "9") return key as PinKey;
  if (key === "Backspace" || key === "Delete") return "erase";
  if (key === "Escape") return "back";
  return null;
}
