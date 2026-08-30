/**
 * « La cible est-elle visible MAINTENANT ? » — bidirectionnel, et c'est tout
 * l'intérêt : la valeur repasse à faux quand l'élément sort de l'écran.
 *
 * À ne pas confondre avec [useNearViewport], dont le verrou est définitif : il
 * répond à « faut-il charger ? », question à laquelle on ne revient jamais.
 * Celui-ci répond à « faut-il continuer d'animer ? », question qui se repose à
 * chaque défilement.
 *
 * Combine la visibilité dans le viewport ET celle de la fenêtre elle-même
 * (`document.visibilityState`) : une animation ne mérite pas plus de tourner
 * quand l'application est passée en arrière-plan que quand elle est hors écran.
 *
 * Le retour par défaut est VRAI, jamais faux : sans IntersectionObserver, ou
 * avant le premier passage de l'observateur, on préfère animer pour rien que
 * figer ce qui devrait bouger.
 *
 * ⚠️ `ref` est un CALLBACK, pas un `useRef` : l'observateur suit l'élément, y
 * compris quand il est REMPLACÉ. L'ancienne version lisait `ref.current` dans
 * un effet à dépendances figées — un consommateur qui démontait puis remontait
 * sa cible (une rangée qui bascule sur sa branche vide, puis revient) laissait
 * l'observateur accroché à un nœud détaché : `visible` restait figé pour
 * toujours, et tout ce qu'il gardait (la fenêtre de cartes d'une rangée)
 * restait vide à l'écran.
 */

import { useCallback, useEffect, useState } from "react";

export function useInViewport<T extends HTMLElement>(rootMargin = "0px") {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setElement(el), []);
  const [onScreen, setOnScreen] = useState(true);
  const [windowVisible, setWindowVisible] = useState(true);

  useEffect(() => {
    if (!element || typeof IntersectionObserver !== "function") {
      // Sans cible (ou sans observateur), on revient au défaut optimiste.
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, rootMargin]);

  useEffect(() => {
    const sync = () => setWindowVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return { ref, visible: onScreen && windowVisible };
}
