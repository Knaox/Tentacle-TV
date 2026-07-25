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
 */

import { useEffect, useRef, useState } from "react";

export function useInViewport<T extends HTMLElement>(rootMargin = "0px") {
  const ref = useRef<T | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [windowVisible, setWindowVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") return;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    const sync = () => setWindowVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return { ref, visible: onScreen && windowVisible };
}
