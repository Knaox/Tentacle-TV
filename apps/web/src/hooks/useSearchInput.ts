import { useEffect, useState } from "react";

/**
 * Le champ de recherche d'une page de grille, débrayé sur l'adresse.
 *
 * La frappe reste locale — l'adresse ne prend que la valeur stabilisée, sans
 * quoi chaque lettre écrirait dans l'historique. Le champ part de ce que porte
 * l'adresse : revenir d'une fiche retrouve la recherche en cours.
 *
 * `pending` : la saisie n'est pas encore partie — de quoi montrer que la
 * recherche travaille, avant même la requête.
 *
 * Écrit deux fois à l'identique (bibliothèque, puis Ma liste et Mes favoris)
 * avant d'être mis en commun.
 */

const SETTLE_MS = 300;

export function useSearchInput(search: string, setSearch: (value: string) => void) {
  const [input, setInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      const value = input.trim();
      if (value !== search) setSearch(value);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [input, search, setSearch]);

  return { input, setInput, pending: input.trim() !== search };
}
