import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { settingDomId } from "./wideSettingsMeta";

/** La page d'une rubrique se charge à la demande : on cherche l'ancre ce temps-là, pas plus. */
const LOOKUP_DEADLINE_MS = 2000;

/**
 * `/settings/<rubrique>#<réglage>` (la recherche, une nouveauté, une ancienne
 * adresse) amène la ligne sous les yeux : l'ancre de la ligne (`setting-<id>`),
 * sinon celle d'un groupe (`#<groupe>`, ou `#octave` d'avant). Une image à la
 * fois tant que la page paresseuse n'a pas rendu, jamais au-delà de 2 s.
 */
export function useSettingHashScroll(): void {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const target = decodeURIComponent(hash.replace(/^#/, ""));
    if (!target) return;
    const started = performance.now();
    let frame = 0;
    const seek = () => {
      const element = document.getElementById(settingDomId(target)) ?? document.getElementById(target);
      if (element) {
        const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
        element.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
        return;
      }
      if (performance.now() - started < LOOKUP_DEADLINE_MS) frame = requestAnimationFrame(seek);
    };
    frame = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
}
