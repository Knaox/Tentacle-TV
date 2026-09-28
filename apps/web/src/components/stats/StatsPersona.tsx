import { memo, useMemo } from "react";
import {
  CalendarHeart, Clapperboard, Compass, Flame, Heart, Hourglass, Languages, Moon, Repeat, Sparkles, Sunrise, Tv,
  type LucideIcon,
} from "lucide-react";
import { viewerBadges, type ViewerBadge, type ViewerBadgeKey, type ViewingStats } from "@tentacle-tv/shared";
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
  polyglot: Languages,
};

const BadgeCard = memo(function BadgeCard({ badge }: { badge: ViewerBadge }) {
  const f = useStatsFormat();
  const Icon = BADGE_ICONS[badge.key];
  const detail = f.t(`badgeDetail_${badge.key}`, {
    share: badge.share !== undefined ? f.percent(badge.share) : "",
    count: badge.count ?? 0,
    label: badge.label ?? "",
  });
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-[color:var(--surface-1)] p-4 ring-1 ring-line-subtle">
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[var(--brand-light)]"
        style={{ background: "rgba(var(--brand-rgb), 0.14)" }}
      >
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold text-content-primary">{f.t(`badge_${badge.key}`)}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-content-secondary">{detail}</span>
      </span>
    </li>
  );
});

/**
 * « Votre profil de spectateur » : le genre de prédilection en grand, puis
 * trois traits au plus (oiseau de nuit, marathonien, fan d'animés…), chacun
 * avec le chiffre qui le justifie. Sur trop peu de données, rien n'est
 * inventé : la section se réduit au genre, ou disparaît.
 */
export const StatsPersona = memo(function StatsPersona({ stats }: { stats: ViewingStats }) {
  const f = useStatsFormat();
  const badges = useMemo(() => viewerBadges(stats), [stats]);
  const genre = stats.genres[0];
  if (!genre && badges.length === 0) return null;

  return (
    <StatsSection title={f.t("personaTitle")} hint={f.t("personaHint")} bare>
      <div className="grid gap-3 lg:grid-cols-3">
        {genre && (
          <div
            className="relative overflow-hidden rounded-2xl p-5 text-white ring-1 ring-[rgba(var(--brand-rgb),0.35)]"
            style={{ background: "linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-dark) 55%, var(--brand-accent-deep) 100%)" }}
          >
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/90">{f.t("favoriteGenre")}</p>
            <p className="mt-2 text-3xl font-bold leading-tight">{genre.label}</p>
            <p className="mt-1 text-sm font-medium text-white/95">{f.t("favoriteGenreDetail", { share: f.percent(genre.share) })}</p>
          </div>
        )}
        {badges.length > 0 && (
          <ul className={`grid gap-3 ${genre ? "lg:col-span-2" : "lg:col-span-3"} ${badges.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {badges.map((b) => <BadgeCard key={b.key} badge={b} />)}
          </ul>
        )}
      </div>
    </StatsSection>
  );
});
