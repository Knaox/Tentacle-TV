/**
 * L'hôte de l'omnibox, monté UNE fois (`App.tsx`) : les raccourcis ⌘K et
 * « / », et l'omnibox elle-même quand elle est ouverte — au-dessus des pages
 * avec ou sans barre de navigation (la fiche d'un film n'en a pas).
 *
 * Absente pendant la lecture : le lecteur a ses propres touches, et « / » y
 * est un raccourci. Absente hors ligne et hors session : il n'y a rien à
 * chercher. Chargée à la demande : tant que personne ne cherche, pas un octet.
 */

import { Suspense, lazy, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { closeOmnibox, useOmnibox, useOmniboxShortcuts } from "./omniboxStore";

const Omnibox = lazy(() => import("./omnibox/Omnibox").then((m) => ({ default: m.Omnibox })));

export function OmniboxHost({ enabled }: { enabled: boolean }) {
  const { pathname } = useLocation();
  const active = enabled && !pathname.startsWith("/watch");
  const { open, seed } = useOmnibox();
  useOmniboxShortcuts(active);

  useEffect(() => {
    if (!active) closeOmnibox();
  }, [active]);

  if (!active || !open) return null;
  return (
    <Suspense fallback={null}>
      <Omnibox seed={seed} onClose={closeOmnibox} />
    </Suspense>
  );
}
