import {
  Compass,
  List,
  BarChart2,
  Search,
  Star,
  Heart,
  Settings,
  Film,
  Tv,
  Music,
  Download,
  Bell,
  Calendar,
  Clock,
  TrendingUp,
  Bookmark,
  Play,
  type LucideIcon,
} from "lucide-react";

/**
 * Map kebab-case icon names (from plugin metadata) to lucide-react components.
 * Extend this map as plugins declare new icons.
 */
const iconMap: Record<string, LucideIcon> = {
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

/** Resolve a lucide icon name string to a JSX element (h-5 w-5). Falls back to text. */
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
