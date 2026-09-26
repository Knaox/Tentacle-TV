import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { readSearchRoute, searchDepth, searchRouteHref, type BrowseTarget } from "./searchRoute";

/**
 * La navigation de la recherche du miroir — `backOrHome` et
 * `useSearchNavigation` de l'app, traduits en historique du navigateur.
 *
 * Dans l'app, la recherche est une MODALE : « Annuler » la referme d'un coup,
 * et un résultat ouvert s'ouvre sur la pile principale, la modale refermée.
 * Ici : « Annuler » dépile la recherche ET les parcours qu'elle a empilés (leur
 * nombre voyage dans l'état de l'entrée), et un résultat REMPLACE l'entrée de
 * la recherche — Retour depuis la fiche ramène là d'où l'on était venu, comme
 * dans l'app. La requête, elle, reste dans les recherches récentes.
 */
export function useSearchRoute() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => readSearchRoute(params), [params]);
  const depth = searchDepth(location.state);
  // Ouverte sur une filmographie (un acteur touché sur une fiche) : « Retour »
  // ramène à la fiche, pas à une recherche vide.
  const openedOnBrowse = useRef(route.browse !== null && depth === 0);

  const cancel = useCallback(() => {
    const state: unknown = window.history.state;
    const idx = typeof state === "object" && state !== null ? (state as { idx?: unknown }).idx : undefined;
    if (typeof idx === "number" && idx > depth) navigate(-(depth + 1));
    else navigate("/", { replace: true });
  }, [navigate, depth]);

  /** Écrit la requête stabilisée dans l'adresse, en sortant d'un parcours s'il y en a un. */
  const writeQuery = useCallback((query: string) => {
    navigate(searchRouteHref(query), { replace: true, state: location.state });
  }, [navigate, location.state]);

  const openBrowse = useCallback((query: string, target: BrowseTarget) => {
    openedOnBrowse.current = false;
    navigate(searchRouteHref(query, target), { state: { searchDepth: depth + 1 } });
  }, [navigate, depth]);

  const closeBrowse = useCallback((query: string) => {
    if (openedOnBrowse.current) cancel();
    else if (depth > 0) navigate(-1);
    else navigate(searchRouteHref(query), { replace: true });
  }, [cancel, navigate, depth]);

  /** Quitte la recherche vers une autre page (fiche, lecteur, page d'extension). */
  const leaveTo = useCallback((path: string) => {
    navigate(path, { replace: true });
  }, [navigate]);

  /** Taper quelque chose, c'est ne plus être « ouvert sur une filmographie ». */
  const forgetOpenedOnBrowse = useCallback(() => {
    openedOnBrowse.current = false;
  }, []);

  return { route, openedOnBrowse, cancel, writeQuery, openBrowse, closeBrowse, leaveTo, forgetOpenedOnBrowse };
}
