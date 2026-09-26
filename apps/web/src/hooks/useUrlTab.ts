import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * L'onglet actif lu dans l'adresse (`?tab=`), et vérifié : une valeur inconnue
 * — un vieux lien, une faute de frappe — retombe sur l'onglet par défaut au
 * lieu d'afficher un panneau vide.
 */
export function resolveTab<T extends string>(raw: string | null, tabs: readonly T[], fallback: T): T {
  return raw !== null && (tabs as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

interface UrlTabOptions<T extends string> {
  /** Nom du paramètre d'adresse. Défaut : `tab`. */
  param?: string;
  /** L'onglet sans paramètre. Défaut : le premier de la liste. */
  fallback?: T;
}

/**
 * Un onglet qui vit dans l'adresse : un lien profond ouvre le bon panneau
 * (`/admin/plugins?tab=sources`), un rechargement le garde, et l'onglet par
 * défaut n'écrit rien — l'adresse reste propre.
 *
 * Le changement REMPLACE l'entrée d'historique au lieu d'en empiler une : le
 * retour du navigateur quitte la page, il ne rejoue pas chaque onglet visité.
 * Les autres paramètres de l'adresse sont conservés.
 */
export function useUrlTab<T extends string>(
  tabs: readonly T[],
  options: UrlTabOptions<T> = {},
): [T, (next: T) => void] {
  const param = options.param ?? "tab";
  const fallback = options.fallback ?? tabs[0];
  const [params, setParams] = useSearchParams();
  const active = resolveTab(params.get(param), tabs, fallback);

  const setActive = useCallback(
    (next: T) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next === fallback) updated.delete(param);
          else updated.set(param, next);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams, param, fallback],
  );

  return [active, setActive];
}
