/**
 * Octave (mobile) — l'onglet allumé (règle partagée `octaveTabOf`) et le geste
 * d'un onglet : revenir à SA racine. La pile se vide d'abord (une page empilée
 * ne reste pas derrière un autre onglet), puis la racine remplace l'écran,
 * en fondu (`animation: "fade"` des racines, `app/octave/_layout.tsx`).
 */

import { useCallback, useRef } from "react";
import { usePathname, useRouter, type Href } from "expo-router";
import { haptic } from "@/utils/haptics";
import { OCTAVE_TAB_ROOTS, octaveTabOf, type OctaveTab } from "@tentacle-tv/shared/octave/mode";

export function useOctaveTab(): { active: OctaveTab; go: (tab: OctaveTab) => void } {
  const pathname = usePathname();
  const router = useRouter();
  const last = useRef<OctaveTab>("home");
  const active = octaveTabOf(pathname, last.current);
  last.current = active;
  const go = useCallback(
    (tab: OctaveTab) => {
      const root = OCTAVE_TAB_ROOTS[tab];
      if (pathname === root) return;
      haptic("select");
      if (router.canDismiss()) router.dismissAll();
      router.replace(root as Href);
    },
    [pathname, router],
  );
  return { active, go };
}
