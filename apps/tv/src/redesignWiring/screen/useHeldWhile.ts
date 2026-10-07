import { useRef } from "react";

/**
 * `value`, mais TENUE tant que `held` est vrai : la valeur d'avant reste
 * rendue, la nouvelle n'est prise qu'une fois `held` retombé. Pour ce qu'une
 * liste en surimpression couvre (profil `holdUnderPanels`) : les mêmes
 * références d'un rendu à l'autre, les vues mémoïsées dessous ne se
 * redessinent pas.
 */
export function useHeldWhile<T>(value: T, held: boolean): T {
  const last = useRef(value);
  if (!held) last.current = value;
  return last.current;
}
