import { i18n } from "@tentacle-tv/shared";
import { applyRailOrder } from "@tentacle-tv/tv-core";
import type { IconName } from "../../../src/redesign/icons/Icon";
import type { NavMenuItem } from "../../../src/redesign/nav/NavEntryMenu";
import type { NavEntry, NavRailProps } from "../../../src/redesign/nav/NavRail";
import type { SettingsNavigation } from "../../../src/redesign/screens/settings/settingsTypes";
import type { BenchData } from "./benchData";

/**
 * La navigation au banc, comme l'app la construit (`useNavEntries`) : les
 * vraies bibliothèques du compte d'abord, puis — pour éprouver le défilement —
 * de quoi en compter autant qu'on veut (clés `Library_bench-<n>`), l'ordre
 * choisi, les masquées et « Tout afficher », la capsule du profil et la
 * légende.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** Des bibliothèques de plus, aux noms plausibles (serveur de famille bien garni). */
const EXTRA: Array<[string, IconName]> = [
  ["Films 4K", "film"],
  ["Documentaires", "film"],
  ["Films d'animation", "film"],
  ["Séries jeunesse", "tv"],
  ["Concerts", "layers"],
  ["Spectacles", "layers"],
  ["Classiques du cinéma", "film"],
  ["Cinéma asiatique", "film"],
  ["Courts métrages", "film"],
  ["Séries britanniques", "tv"],
  ["Mangas animés", "tv"],
  ["Sport", "layers"],
  ["Émissions TV", "tv"],
  ["Films de Noël", "film"],
  ["Westerns", "film"],
  ["Science-fiction", "film"],
  ["Films d'horreur", "film"],
  ["Comédies musicales", "film"],
  ["Stand-up", "layers"],
  ["Films de famille", "layers"],
  ["Téléfilms", "film"],
  ["Séries policières", "tv"],
  ["Opéras", "layers"],
  ["Jeux vidéo", "layers"],
];

/** Les bibliothèques du banc : les vraies, puis de quoi en avoir `count`. */
export function benchLibraries(data: BenchData, count?: number): NavEntry[] {
  const real = data.snapshot.libraries.map((lib): NavEntry => ({
    key: `Library_${lib.id}`,
    label: lib.name,
    icon: lib.collectionType === "movies" ? "film" : lib.collectionType === "tvshows" ? "tv" : "layers",
  }));
  const wanted = count ?? real.length;
  const extra = EXTRA.slice(0, Math.max(0, wanted - real.length)).map(
    ([label, icon], index): NavEntry => ({ key: `Library_bench-${index}`, label, icon }),
  );
  return [...real, ...extra];
}

export interface BenchNavOptions {
  expanded?: boolean;
  /** Le nombre de bibliothèques ; défaut : celles du compte. */
  libraries?: number;
  hidden?: string[];
  /** L'ordre choisi des entrées organisables. */
  order?: string[];
  heldKey?: string | null;
  movingKey?: string | null;
}

/** Les entrées organisables, dans l'ordre choisi (masquées comprises). */
export function benchMovable(data: BenchData, options: BenchNavOptions = {}): NavEntry[] {
  const movable: NavEntry[] = [
    { key: "Recommendations", label: t("nav:forYou"), icon: "sparkles" },
    { key: "Watchlist", label: t("nav:myList"), icon: "bookmark" },
    { key: "Favorites", label: t("common:myFavorites"), icon: "heart" },
    ...benchLibraries(data, options.libraries),
  ];
  return applyRailOrder(movable, options.order ?? [], (entry) => entry.key);
}

export function benchNav(data: BenchData, activeKey: string, options: BenchNavOptions = {}): NavRailProps {
  const hidden = new Set(options.hidden ?? []);
  const movable = benchMovable(data, options);
  const entries: NavEntry[] = [
    { key: "Home", label: t("nav:home"), icon: "home" },
    ...movable.filter((entry) => !hidden.has(entry.key)),
  ];
  if (movable.some((entry) => hidden.has(entry.key))) entries.push({ key: "RailShowAll", label: t("nav:railShowAll"), icon: "eye" });
  const profile = data.snapshot.profile;
  const moving = !!options.movingKey;
  return {
    search: { key: "Search", label: t("nav:search"), icon: "search" },
    entries,
    account: {
      key: "Settings",
      label: profile?.name ?? t("nav:preferences"),
      caption: profile?.name ? t("nav:railProfile") : undefined,
      avatarUri: profile?.image ? data.imageFile(profile.image) : undefined,
      initial: profile?.name?.[0]?.toUpperCase(),
    },
    activeKey,
    expanded: options.expanded ?? false,
    hints: moving
      ? [
          { icon: "moveVertical", label: t("nav:railHintMove") },
          { icon: "circleDot", label: t("nav:railHintDrop") },
        ]
      : [
          { icon: "chevronLeft", label: t("nav:railProfile") },
          { icon: "circleDot", label: t("nav:railHintOrganize") },
        ],
    heldKey: options.heldKey ?? null,
    movingKey: options.movingKey ?? null,
  };
}

/** Le menu d'appui long d'une entrée, tel que `NavMenuModal` le compose. */
export function benchMenu(nav: NavRailProps, heldKey: string, canShowAll: boolean): { title: string; caption: string; items: NavMenuItem[] } {
  const visible = nav.entries.filter((entry) => entry.key !== "Home" && entry.key !== "RailShowAll");
  const index = visible.findIndex((entry) => entry.key === heldKey);
  return {
    title: visible[index]?.label ?? heldKey,
    caption: t("nav:railMenuPosition", { position: index + 1, count: visible.length }),
    items: [
      { key: "move", label: t("nav:railMenuMove"), icon: "moveVertical" },
      { key: "up", label: t("nav:railMenuUp"), icon: "chevronUp", disabled: index <= 0 },
      { key: "down", label: t("nav:railMenuDown"), icon: "chevronDown", disabled: index >= visible.length - 1 },
      { key: "hide", label: t("nav:railMenuHide"), icon: "eyeOff" },
      ...(canShowAll ? [{ key: "showAll", label: t("nav:railShowAll"), icon: "eye" } as const] : []),
      { key: "settings", label: t("nav:railMenuSettings"), icon: "panelLeft" },
    ],
  };
}

/** Le réglage « Navigation » des réglages, sur les mêmes entrées. */
export function benchNavigationSettings(data: BenchData, options: BenchNavOptions = {}): SettingsNavigation {
  const hidden = new Set(options.hidden ?? []);
  const entries = benchMovable(data, options).map(({ key, label, icon }) => ({ key, label, icon, hidden: hidden.has(key) }));
  const defaults = benchMovable(data, { ...options, order: [] }).map((entry) => entry.key);
  return {
    entries,
    movingKey: options.movingKey ?? null,
    canShowAll: hidden.size > 0,
    canResetOrder: entries.some((entry, index) => entry.key !== defaults[index]),
  };
}
