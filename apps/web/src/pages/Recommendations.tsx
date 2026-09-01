import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRecoOverview, useRecoRow } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import { PageTransition } from "../components/PageTransition";
import { ColdStart } from "../components/reco/ColdStart";
import { RecoHero } from "../components/reco/RecoHero";
import { RecoRow } from "../components/reco/RecoRow";

/**
 * Page Recommandations. Toute la matière vient du backend (pool + rangées
 * dérivées) ; la page choisit seulement quoi montrer selon l'état du moteur :
 * désactivé → renvoi vers les réglages ; froid → grille de notation ;
 * en chauffe → rangées + indicateur discret ; prêt → rangées.
 * Une rangée vide ne rend RIEN (dégradé silencieux, jamais d'erreur).
 */
export function Recommendations() {
  const { t } = useTranslation("reco");
  const { data: overview, isPending } = useRecoOverview();

  if (isPending) {
    return (
      <div className="row-gutter pt-8">
        <Shimmer className="h-56 w-full rounded-2xl" />
        <Shimmer className="mt-10 h-8 w-64 rounded" />
        <div className="mt-4 flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Shimmer key={i} className="h-[270px] w-[180px] shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview) return null;

  if (overview.state === "disabled") {
    return (
      <PageTransition>
        <div className="row-gutter flex min-h-[60vh] flex-col items-start justify-center">
          <h1 className="text-2xl font-bold text-content-primary">{t("pageTitle")}</h1>
          <p className="mt-3 max-w-xl text-content-secondary">{t("disabledBody")}</p>
          <Link
            to="/settings/personalization"
            className="mt-5 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 py-2.5 font-semibold text-cta-primary-fg transition-colors hover:bg-cta-primary-bg-hover"
          >
            {t("disabledCta")}
          </Link>
        </div>
      </PageTransition>
    );
  }

  if (overview.state === "cold") {
    return (
      <PageTransition>
        <div className="min-h-screen pb-20">
          <ColdStart signalCount={overview.signalCount} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        <HeroSlot />

        {overview.state === "warming" && (
          <p className="row-gutter mb-6 text-sm text-content-tertiary">{t("warmingHint")}</p>
        )}

        {overview.generating && overview.rows.length === 0 && (
          <p className="row-gutter mb-6 text-sm text-content-tertiary">{t("generatingHint")}</p>
        )}

        {overview.rows.map((row, i) => (
          <RowSlot key={row.key} rowKey={row.key} seedTitle={row.seedTitle} animDelay={150 + i * 80} />
        ))}
      </div>
    </PageTransition>
  );
}

/** Le héros consomme la tête de « Pour vous » — même requête que la rangée. */
function HeroSlot() {
  const { data } = useRecoRow("forYou");
  return <RecoHero item={data?.items?.[0]} />;
}

function RowSlot({
  rowKey,
  seedTitle,
  animDelay,
}: {
  rowKey: string;
  seedTitle?: string;
  animDelay: number;
}) {
  const { t } = useTranslation("reco");
  const { data } = useRecoRow(rowKey);
  if (!data?.items?.length) return null;

  // La tête de « Pour vous » vit déjà dans le héros — pas deux fois à l'écran.
  const items = rowKey === "forYou" ? data.items.slice(1) : data.items;

  const title = rowKey.startsWith("becauseYouLiked:")
    ? t("rowBecauseYouLiked", { title: seedTitle ?? data.seedTitle ?? "" })
    : t(ROW_TITLE_KEYS[rowKey] ?? "rowForYou");

  return <RecoRow title={title} items={items} animDelay={animDelay} />;
}

const ROW_TITLE_KEYS: Record<string, string> = {
  forYou: "rowForYou",
  inLibrary: "rowInLibrary",
  discover: "rowDiscover",
  community: "rowCommunity",
  exploration: "rowExploration",
};
