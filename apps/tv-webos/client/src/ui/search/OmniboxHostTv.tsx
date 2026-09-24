import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isInputField } from "../../focus/candidates";
import { RAIL_SELECTOR } from "../../focus/zones";
import { openSearch } from "./searchState";

/**
 * Les raccourcis d'un clavier branché au téléviseur — ⌘K / Ctrl+K et « / » —
 * ouvrent la recherche DU TÉLÉVISEUR.
 *
 * Substitué à `components/search/OmniboxHost.tsx`, monté par `App.tsx`. Le
 * web y charge son omnibox, qui interroge aussi les extensions hors
 * bibliothèque : le téléviseur s'en tient à la bibliothèque, et une seule
 * recherche vaut mieux que deux qui ne disent pas la même chose. L'omnibox et
 * ses recherches extérieures sortent ainsi du bundle.
 *
 * La surcouche vit dans la disposition (`LayoutTv`) : hors d'elle — fiche,
 * lecteur —, le raccourci ne fait rien plutôt que d'ouvrir une recherche qui
 * n'apparaîtrait qu'au retour.
 */
export function OmniboxHost({ enabled }: { enabled: boolean }) {
  const { pathname } = useLocation();
  const active = enabled && !pathname.startsWith("/watch");

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const key = (event.key ?? "").toLowerCase();
      const shortcut = (event.metaKey || event.ctrlKey) && !event.shiftKey && key === "k";
      const slash = key === "/" && !event.metaKey && !event.ctrlKey
        && !isInputField(event.target instanceof HTMLElement ? event.target : null);
      if (!shortcut && !slash) return;
      if (!document.querySelector(RAIL_SELECTOR)) return;
      event.preventDefault();
      openSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return null;
}
