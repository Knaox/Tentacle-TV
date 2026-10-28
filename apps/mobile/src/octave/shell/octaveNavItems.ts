/** Octave (mobile) — les onglets et leurs glyphes (Lucide, un seul jeu de traits). */

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
