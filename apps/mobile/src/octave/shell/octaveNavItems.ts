/**
 * Octave (mobile) — les onglets et leurs glyphes (Lucide, un seul jeu de traits).
 * La barre latérale (tablette) les liste tous ; la barre du téléphone, à la
 * Apple Music, garde les destinations dans sa pilule et met la RECHERCHE à
 * part, dans un rond à droite.
 */

import { House, Library, Search, type LucideIcon } from "lucide-react-native";
import type { OctaveTab } from "@tentacle-tv/shared/octave/mode";

export interface OctaveNavItem {
  tab: OctaveTab;
  /** Clé de l'espace i18n `music` (`nav.*`). */
  labelKey: string;
  Icon: LucideIcon;
}

export const OCTAVE_NAV_ITEMS: readonly OctaveNavItem[] = [
  { tab: "home", labelKey: "nav.home", Icon: House },
  { tab: "search", labelKey: "nav.search", Icon: Search },
  { tab: "library", labelKey: "nav.library", Icon: Library },
];

/** La pilule de la barre du téléphone : tout sauf la recherche. */
export const OCTAVE_PILL_ITEMS: readonly OctaveNavItem[] = OCTAVE_NAV_ITEMS.filter((item) => item.tab !== "search");

/** Le rond à droite de la barre du téléphone. */
export const OCTAVE_SEARCH_ITEM: OctaveNavItem = OCTAVE_NAV_ITEMS.find((item) => item.tab === "search")!;
