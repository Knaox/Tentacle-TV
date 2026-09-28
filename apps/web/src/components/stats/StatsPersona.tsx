import { memo, useMemo } from "react";
import {
  CalendarHeart, Clapperboard, Compass, Drama, Flame, Globe, Headphones, Heart, Hourglass, Moon, Repeat, Sparkles, Sunrise, Tv,
  type LucideIcon,
} from "lucide-react";
import { viewerBadges, type ViewerBadgeKey, type ViewingStats } from "@tentacle-tv/shared";
import { StatsSection } from "./StatsSection";
import { useStatsFormat } from "./useStatsFormat";

const BADGE_ICONS: Record<ViewerBadgeKey, LucideIcon> = {
  nightOwl: Moon,
  earlyBird: Sunrise,
  weekend: CalendarHeart,
  binger: Flame,
  regular: Repeat,
  cinephile: Clapperboard,
  seriesAddict: Tv,
  animeFan: Sparkles,
  loyal: Heart,
  explorer: Compass,
  vintage: Hourglass,
  polyglot: Headphones,
  worldly: Globe,
};

interface Trait {
  key: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
}

const TraitItem = memo(function TraitItem({ trait }: { trait: Trait }) {
  const { Icon } = trait;
  return (
    <li className="flex min-w-0 gap-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fill-soft text-[var(--brand-light)]">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-snug text-content-primary">{trait.title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-content-secondary">{trait.detail}</span>
      </span>
    </li>
  );
});

/**
 * « Votre profil de spectateur » : le genre de prédilection, puis trois
 * traits au plus (oiseau de nuit, marathonien…), chacun avec le chiffre qui
 * le justifie — tous à la même enseigne, sans aplat de couleur. Sur trop peu
 * de données, rien n'est inventé : la section se réduit au genre, ou
 * disparaît.
 */
export const StatsPersona = memo(function StatsPersona({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const traits = useMemo(() => {
    const out: Trait[] = [];
    const genre = stats.genres[0];
    if (genre) {
      out.push({
        key: "genre",
        Icon: Drama,
        title: genre.label,
        detail: `${f.t("favoriteGenre")} · ${f.t("favoriteGenreDetail", { share: f.percent(genre.share) })}`,
      });
    }
    for (const badge of viewerBadges(stats)) {
      out.push({
        key: badge.key,
        Icon: BADGE_ICONS[badge.key],
        title: f.t(`badge_${badge.key}`),
        detail: f.t(`badgeDetail_${badge.key}`, {
          share: badge.share !== undefined ? f.percent(badge.share) : "",
          count: badge.count ?? 0,
          label: badge.label ?? "",
          duration: badge.seconds !== undefined ? f.duration(badge.seconds) : "",
        }),
      });
    }
    return out;
  }, [stats, f]);
  if (traits.length === 0) return null;

  return (
    <StatsSection title={f.t("personaTitle")} hint={f.t("personaHint")}>
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        {traits.map((trait) => <TraitItem key={trait.key} trait={trait} />)}
      </ul>
    </StatsSection>
  );
});
