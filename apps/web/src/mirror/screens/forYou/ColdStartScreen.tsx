import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import {
  ratingKey,
  useColdStartTitles,
  useDeleteRating,
  useMyRatings,
  useRateItem,
  useRecoWarmup,
  type ColdStartTitle,
  type RatingIdentity,
} from "@tentacle-tv/api-client";
import { FadeIn } from "../../hero/FadeIn";
import { Skeleton } from "../../hero/Skeletons";
import { RAIL_WIDTH } from "../../responsive";
import { TAB_BAR_TOTAL } from "../../shell/metrics";
import { useSideNav } from "../../useFormFactor";
import { useGrid } from "../../useMirrorLayout";
import { ColdStartCard } from "./ColdStartCard";
import { PillButton } from "./PillButton";

/** Un « j'aime » de la grille vaut 8/10 : signal franc, qui laisse 9 et 10
 *  aux coups de cœur notés finement sur les fiches. */
const LIKE_SCORE = 8;
const PAGE_SIZE = 24;
const TARGET = 5;
const PILL_H = 56;

function identityOf(title: ColdStartTitle): RatingIdentity {
  return { mediaType: title.mediaType === "tv" ? "series" : "movie", tmdbId: title.tmdbId };
}

/**
 * `ColdStartScreen` de l'app : sous cinq signaux, une grille (3 colonnes au
 * téléphone, dérivées de 150 sur tablette) de titres à aimer en UN appui, une
 * progression de 140 × 6, « Plus tard », et — seuil atteint — une pilule de
 * 56 posée au-dessus de la barre d'onglets (ou du bas, avec le rail) : la
 * bascule est VOLONTAIRE, la grille ne se dérobe jamais seule.
 */
export function ColdStartScreen({ signalCount, onDone, onLater }: {
  signalCount: number;
  onDone: () => void;
  onLater: () => void;
}) {
  const { t } = useTranslation("reco");
  const sideNav = useSideNav();
  const grid = useGrid({ phoneColumns: 3 });
  const pillBottom = sideNav ? "calc(env(safe-area-inset-bottom, 0px) + 12px)" : `calc(${TAB_BAR_TOTAL} + 12px)`;

  const { data, isPending } = useColdStartTitles(true);
  const { data: ratings } = useMyRatings();
  const rate = useRateItem();
  const remove = useDeleteRating();
  const warmup = useRecoWarmup();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const items = useMemo(() => data?.items ?? [], [data]);
  const ratedKeys = useMemo(() => new Set((ratings ?? []).map((r) => ratingKey(r))), [ratings]);
  const pickedHere = items.filter((i) => ratedKeys.has(ratingKey(identityOf(i)))).length;
  // Signaux déjà au profil + choix de la grille (le profil, recalculé derrière
  // un debounce, ne les compte pas encore).
  const progress = signalCount + pickedHere;
  const ready = progress >= TARGET;

  const toggle = useCallback(
    (title: ColdStartTitle, selected: boolean) => {
      const identity = identityOf(title);
      if (selected) remove.mutate(identity);
      else rate.mutate({ ...identity, jellyfinItemId: title.jellyfinItemId, score: LIKE_SCORE });
    },
    [rate, remove],
  );
  // Bascule INSTANTANÉE : le serveur répond 202 et reconstruit en fond.
  const finish = () => {
    warmup.mutate();
    onDone();
  };

  return (
    <div className="pt-3" style={{ paddingBottom: `calc(${PILL_H + 20}px + 12px)` }}>
      <div className="mb-5 flex max-w-[720px] flex-col gap-2" style={{ paddingInline: grid.padding }}>
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-brand-light" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[1.2px] text-brand-light">{t("coldKicker")}</span>
        </div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-content-primary">{t("coldTitle")}</h1>
        <p className="text-[15px] text-content-secondary">{t("coldBody")}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 w-[140px] overflow-hidden rounded-[3px]" style={{ background: "var(--border-strong)" }}>
            <div
              className="h-full rounded-[3px]"
              style={{
                width: `${Math.min(progress / TARGET, 1) * 100}%`,
                background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
              }}
            />
          </div>
          <span className="text-[13px] font-semibold text-content-primary" aria-live="polite">
            {t("coldProgress", { count: Math.min(progress, TARGET) })}
          </span>
          <button type="button" onClick={onLater} className="ml-auto flex min-h-[44px] items-center px-1 text-[13px] font-medium text-content-tertiary">
            {t("coldLater")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-y-4" style={{ paddingInline: grid.padding, columnGap: grid.gutter }}>
        {isPending
          ? Array.from({ length: grid.numColumns * 3 }, (_, i) => (
              <div key={i} style={{ width: grid.itemWidth }}>
                <Skeleton width={grid.itemWidth} height={grid.itemWidth * 1.5} radius={12} />
                <Skeleton width={grid.itemWidth * 0.7} height={12} className="mt-2.5" />
              </div>
            ))
          : items.slice(0, visible).map((title) => (
              <ColdStartCard
                key={title.jellyfinItemId}
                title={title}
                width={grid.itemWidth}
                selected={ratedKeys.has(ratingKey(identityOf(title)))}
                onToggle={toggle}
              />
            ))}
      </div>

      {!isPending && visible < items.length && (
        <div className="mt-5 flex justify-center">
          <PillButton title={t("coldMore")} variant="ghost" onPress={() => setVisible((v) => v + PAGE_SIZE)} />
        </div>
      )}

      {ready && (
        <div
          className="pointer-events-none fixed right-0 z-40 flex justify-center"
          style={{ bottom: pillBottom, left: sideNav ? RAIL_WIDTH : 0 }}
        >
          <FadeIn>
            <div
              className="pointer-events-auto mx-4 flex max-w-[520px] items-center gap-3 rounded-full border-[0.5px] border-line-subtle bg-surface-1 py-1.5 pl-4 pr-2"
              style={{ minHeight: PILL_H, boxShadow: "0 -8px 24px rgba(0,0,0,0.45)" }}
            >
              <p className="min-w-0 shrink truncate text-[13px] text-content-secondary">{t("coldReadyHint")}</p>
              <PillButton title={t("coldCta")} onPress={finish} />
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}
