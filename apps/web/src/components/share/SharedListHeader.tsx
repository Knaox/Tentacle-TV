import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ShareListKind } from "@tentacle-tv/api-client";
import { TentacleLogo } from "../ui/TentacleLogo";
import type { ShareSummary } from "./shareSummary";

interface Props {
  ownerUsername: string;
  kind: ShareListKind;
  summary: ShareSummary;
}

/**
 * Ce qu'on partage, en une lecture : la marque (on sait d'où vient le lien),
 * un surtitre au point de marque comme la fiche, le titre qui nomme l'auteur,
 * puis un bilan chiffré à la manière de Ma liste (« 24 titres · 16 films ·
 * 8 séries ») et la promesse de lecture seule.
 */
export const SharedListHeader = memo(function SharedListHeader({ ownerUsername, kind, summary }: Props) {
  const { t } = useTranslation("share");
  const parts = [
    t("summaryTitles", { count: summary.total }),
    summary.movies > 0 ? t("summaryMovies", { count: summary.movies }) : null,
    summary.series > 0 ? t("summarySeries", { count: summary.series }) : null,
    summary.offServer > 0 ? t("summaryOffServer", { count: summary.offServer }) : null,
  ].filter(Boolean);

  return (
    <header className="min-w-0 animate-fade-slide-up">
      <TentacleLogo size="sm" wordmark wordmarkText="Tentacle TV" />
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">
        <span
          aria-hidden
          className="mr-2 inline-block h-1.5 w-1.5 -translate-y-px rounded-full align-middle"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        />
        {t(kind === "likes" ? "kickerLikes" : "kickerWatchlist")}
      </p>
      <h1 className="mt-2 break-words text-3xl font-extrabold tracking-tight text-content-primary md:text-5xl">
        {t(kind === "likes" ? "titleLikes" : "titleWatchlist", { name: ownerUsername })}
      </h1>
      <p className="mt-3 text-sm font-medium tabular-nums text-content-secondary md:text-base">{parts.join(" · ")}</p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-tertiary">
        {t("readOnlyNote", { name: ownerUsername })} {t("liveNote")}
      </p>
    </header>
  );
});
