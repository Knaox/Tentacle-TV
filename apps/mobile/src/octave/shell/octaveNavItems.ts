/**
 * Octave (mobile) — les onglets et leurs glyphes (Lucide, un seul jeu de traits).
 * La barre latérale (tablette) les liste tous ; la barre du téléphone, à la
 * Apple Music, garde les destinations dans sa pilule et met la RECHERCHE à
 * part, dans un rond à droite. « Hors ligne » (« Sur cet appareil ») n'est
 * montré qu'avec le droit du compte de l'appareil (`useOfflineTab`) ; son
 * glyphe est le disque fléché d'Apple Music, au trait comme les autres.
 */

import { CircleArrowDown, House, Library, Search, type LucideIcon } from "lucide-react-native";
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
  { tab: "offline", labelKey: "nav.offline", Icon: CircleArrowDown },
];

/** La pilule de la barre du téléphone : tout sauf la recherche. */
export const OCTAVE_PILL_ITEMS: readonly OctaveNavItem[] = OCTAVE_NAV_ITEMS.filter((item) => item.tab !== "search");

/** Le rond à droite de la barre du téléphone. */
export const OCTAVE_SEARCH_ITEM: OctaveNavItem = OCTAVE_NAV_ITEMS.find((item) => item.tab === "search")!;
