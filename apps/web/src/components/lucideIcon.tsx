import { CompassIcon as Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { ListIcon as List } from "@phosphor-icons/react/dist/csr/List";
import { ChartBarIcon as BarChart2 } from "@phosphor-icons/react/dist/csr/ChartBar";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { StarIcon as Star } from "@phosphor-icons/react/dist/csr/Star";
import { HeartIcon as Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { GearSixIcon as Settings } from "@phosphor-icons/react/dist/csr/GearSix";
import { FilmStripIcon as Film } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import { MusicNotesIcon as Music } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { DownloadSimpleIcon as Download } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { BellIcon as Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { CalendarBlankIcon as Calendar } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { ClockIcon as Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { TrendUpIcon as TrendingUp } from "@phosphor-icons/react/dist/csr/TrendUp";
import { BookmarkSimpleIcon as Bookmark } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { PlayIcon as Play } from "./icons/transport";
import type { Icon as IconType } from "@phosphor-icons/react";

/**
 * Les noms d'icônes que les extensions déclarent (métadonnées, entrées de navigation) → leur
 * composant. Ces noms sont ceux de lucide et TRAVERSENT le réseau : ils ne changent pas, des
 * extensions publiées hors du dépôt les envoient. Seule la cible a changé — Phosphor, depuis la
 * refonte de nov. 2026. Le nom du fichier et de ses fonctions reste, pour la même raison.
 */
const iconMap: Record<string, IconType> = {
  compass: Compass,
  list: List,
  "bar-chart-2": BarChart2,
  search: Search,
  star: Star,
  heart: Heart,
  settings: Settings,
  film: Film,
  tv: Tv,
  music: Music,
  download: Download,
  bell: Bell,
  calendar: Calendar,
  clock: Clock,
  "trending-up": TrendingUp,
  bookmark: Bookmark,
  play: Play,
};

/** Le composant d'une icône de plugin, ou `null` si ce nom n'est pas dans la table. */
export function lucideIconFor(name: string | null | undefined): IconType | null {
  return (name && iconMap[name]) || null;
}

/** Le nom d'icône d'une extension → son élément (h-5 w-5) ; un nom inconnu s'écrit en texte. */
export function getLucideIcon(name: string): React.ReactNode {
  const Icon = iconMap[name];
  if (Icon) return <Icon className="h-5 w-5" />;
  return <span className="h-5 w-5 flex items-center justify-center text-xs">{name}</span>;
}

/**
 * Resolve a plugin nav label that can be either a plain string or
 * an i18n object like { en: "Discover", fr: "Découvrir" }.
 */
export function resolvePluginLabel(label: string | Record<string, string> | undefined, lang: string): string {
  if (!label) return "";
  if (typeof label === "string") return label;
  // Try exact match ("fr"), then base language ("fr" from "fr-FR"), then fallbacks
  return label[lang] || label[lang.split("-")[0]] || label.en || label.fr || Object.values(label)[0] || "";
}
