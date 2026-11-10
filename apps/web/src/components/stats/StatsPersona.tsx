import { memo, useMemo } from "react";
import { CalendarHeartIcon as CalendarHeart } from "@phosphor-icons/react/dist/csr/CalendarHeart";
import { FilmSlateIcon as Clapperboard } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { CompassIcon as Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { MaskHappyIcon as Drama } from "@phosphor-icons/react/dist/csr/MaskHappy";
import { FireIcon as Flame } from "@phosphor-icons/react/dist/csr/Fire";
import { GlobeIcon as Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { HeadphonesIcon as Headphones } from "@phosphor-icons/react/dist/csr/Headphones";
import { HeartIcon as Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { HourglassIcon as Hourglass } from "@phosphor-icons/react/dist/csr/Hourglass";
import { MoonIcon as Moon } from "@phosphor-icons/react/dist/csr/Moon";
import { RepeatIcon as Repeat } from "@phosphor-icons/react/dist/csr/Repeat";
import { SparkleIcon as Sparkles } from "@phosphor-icons/react/dist/csr/Sparkle";
import { SunHorizonIcon as Sunrise } from "@phosphor-icons/react/dist/csr/SunHorizon";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import type { Icon as IconType } from "@phosphor-icons/react";
import { viewerBadges, type RhythmInsight, type ViewerBadgeKey, type ViewingStats } from "@tentacle-tv/shared";
import { StatsSection } from "./StatsSection";
import { useStatsFormat } from "./useStatsFormat";

const BADGE_ICONS: Record<ViewerBadgeKey, IconType> = {
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
  Icon: IconType;
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
export const StatsPersona = memo(function StatsPersona({ stats, rhythm }: {
  stats: ViewingStats;
  /** La lecture du rythme quand la grille manque : les habitudes de la page publique (`habitsInsight`). */
  rhythm?: RhythmInsight;
}) {
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
    for (const badge of viewerBadges(stats, undefined, rhythm)) {
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
  }, [stats, rhythm, f]);
  if (traits.length === 0) return null;

  return (
    <StatsSection title={f.t("personaTitle")} hint={f.t("personaHint")}>
      <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        {traits.map((trait) => <TraitItem key={trait.key} trait={trait} />)}
      </ul>
    </StatsSection>
  );
});
