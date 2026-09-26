import { useTranslation } from "react-i18next";
import { AlertCircle, SlidersVertical } from "lucide-react";
import { recoRowTitle, type RecoPage } from "@tentacle-tv/api-client";
import { FadeIn } from "../../hero/FadeIn";
import { SkeletonRow } from "../../hero/Skeletons";
import { PillButton } from "./PillButton";
import { RecoRow, type RecoRowActions } from "./RecoRow";

/**
 * `RecoPageHeader` de l'app : titre compact 22 extra-gras (ou rien, sous le
 * carrousel) et le bouton rond Filtres de 44, teinté de marque et coiffé d'un
 * compteur de 18 quand un filtre est posé. 16 au-dessus (12 sous le carrousel).
 */
export function RecoPageHeader({ showTitle, filterCount, onOpenFilters }: {
  showTitle: boolean;
  filterCount: number;
  onOpenFilters: () => void;
}) {
  const { t } = useTranslation("reco");
  const active = filterCount > 0;
  return (
    <div className={`flex items-center justify-between gap-3 px-4 ${showTitle ? "pt-4" : "pt-3"}`}>
      {showTitle ? (
        <h1 className="flex-1 text-[22px] font-extrabold tracking-[-0.5px] text-content-primary">{t("pageTitle")}</h1>
      ) : (
        <div className="flex-1" />
      )}
      <div className="relative">
        <button
          type="button"
          onClick={onOpenFilters}
          aria-label={active ? `${t("filtersButton")}, ${filterCount}` : t("filtersButton")}
          className={`mirror-press flex h-11 w-11 items-center justify-center rounded-full ${active ? "text-brand-light" : "text-content-primary"}`}
          style={{ background: active ? "var(--brand-soft)" : "var(--fill-subtle)" }}
        >
          <SlidersVertical size={22} aria-hidden />
        </button>
        {active && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand)] px-[5px] text-[10px] font-bold text-cta-brand-fg">
            {filterCount}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * `RecoStatusBanner` de l'app : UN bandeau à la fois, le premier vrai gagne —
 * perso coupée par l'utilisateur, puis (clé TMDB absente : rien) les états de
 * calcul du profil et du pool. Indication 13 tertiaire, ou bloc actionnable
 * (filet, fond faint, rayon 12) à pilule blanche.
 */
export function RecoStatusBanner({ page, hasPersonalizedRows, onOpenColdStart, onOpenSettings }: {
  page: RecoPage;
  hasPersonalizedRows: boolean;
  onOpenColdStart: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation("reco");
  const cold = page.state === "cold";
  const hint = (text: string) => <p className="mt-3 px-4 text-[13px] text-content-tertiary">{text}</p>;
  const actionable = (text: string, cta: string, onPress: () => void) => (
    <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-[0.5px] border-line-subtle bg-fill-faint px-3 py-2">
      <p className="min-w-[180px] flex-1 text-[13px] text-content-secondary">{text}</p>
      <PillButton title={cta} onPress={onPress} />
    </div>
  );

  if (page.personalized === false) return actionable(t("disabledBanner"), t("disabledBannerCta"), onOpenSettings);
  if (page.tmdbConfigured === false) return null;
  if (cold && (page.generating || page.refining)) return hint(t("generatingHint"));
  if (cold) return actionable(t("coldBannerHint"), t("coldBannerCta"), onOpenColdStart);
  if (page.exploring) return hint(t("exploringHint"));
  if (page.state === "warming") return hint(t("warmingHint"));
  if (page.generating && !hasPersonalizedRows) return hint(t("generatingHint"));
  if (page.refining && page.rows.length > 0) return hint(t("preliminaryHint"));
  return null;
}

/**
 * `RecoPageRows` de l'app : les rangées servies, la première raison sous
 * chaque carte ; squelettes seulement quand le moteur génère sans rien avoir
 * servi ; sous filtre, une page vide le dit une fois. Un échange de filtre
 * ATTÉNUE (opacité 0,6), ne blanchit pas.
 */
export function RecoPageRows({ page, filtered, stale, ...actions }: {
  page: RecoPage;
  filtered: boolean;
  stale: boolean;
} & RecoRowActions) {
  const { t } = useTranslation("reco");
  let body;
  if (page.generating && page.rows.length === 0) {
    body = [0, 1, 2].map((i) => (
      <div key={i} className="mt-6">
        <SkeletonRow />
      </div>
    ));
  } else if (filtered && page.rows.length === 0) {
    body = <p className="mt-5 px-4 text-[15px] text-content-tertiary">{t("filterEmpty")}</p>;
  } else {
    body = page.rows.map((row, i) => {
      const { key, params } = recoRowTitle(row);
      return (
        <FadeIn key={row.key} delay={Math.min(i, 4) * 60}>
          <RecoRow title={t(key, params)} items={row.items} showReasons {...actions} />
        </FadeIn>
      );
    });
  }
  return <div style={{ opacity: stale ? 0.6 : 1, transition: "opacity 200ms ease" }}>{body}</div>;
}

/** `RecoErrorState` de l'app : la page n'a rien à montrer et le serveur ne répond pas. */
export function RecoErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("reco");
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertCircle size={36} className="text-brand-light" aria-hidden />
      <p className="max-w-[320px] text-[15px] text-content-secondary">{t("loadError")}</p>
      <PillButton title={tc("retry")} variant="secondary" onPress={onRetry} />
    </div>
  );
}

/** `RecoDisabledState` de l'app : vieux serveur sans rangée en mode désactivé. */
export function RecoDisabledState({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useTranslation("reco");
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-content-primary">{t("pageTitle")}</h1>
      <p className="max-w-[420px] text-[15px] text-content-secondary">{t("disabledBody")}</p>
      <PillButton title={t("disabledCta")} onPress={onOpenSettings} />
    </div>
  );
}
