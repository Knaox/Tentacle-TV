import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRecoOverview } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import { PageTransition } from "../components/PageTransition";
import { ColdStart } from "../components/reco/ColdStart";
import { RecoBillboardSlot } from "../components/reco/hero/RecoBillboardSlot";
import { useRecoHeroSlides } from "../components/reco/hero/recoHeroSlides";
import { RecoRowSkeleton } from "../components/reco/RecoRowSkeleton";
import { RecoRowSlot } from "../components/reco/RecoRowSlot";

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
  // Même clé de cache que la rangée « Pour vous » : zéro requête en plus.
  const { excludeKeys } = useRecoHeroSlides();
  // Le démarrage à froid est COLLANT : une fois affiché (« hold »), il ne cède
  // l'écran qu'au bouton « Voir mes recommandations » — jamais à un refetch
  // d'arrière-plan en pleine sélection. « dismissed » survit tant que le
  // serveur dit encore « cold » (la bascule est instantanée, le profil se
  // reconstruit derrière) : sans lui, la grille se ré-afficherait une seconde
  // après le clic. L'état se réarme dès que le serveur a vraiment tourné.
  const [phase, setPhase] = useState<"auto" | "hold" | "dismissed">("auto");
  useEffect(() => {
    if (overview?.state === "cold") setPhase((p) => (p === "auto" ? "hold" : p));
    else setPhase("auto");
  }, [overview?.state]);

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

  if (phase === "hold") {
    return (
      <PageTransition>
        <div className="min-h-screen pb-20">
          <ColdStart signalCount={overview.signalCount} onDone={() => setPhase("dismissed")} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        <div className="pt-6">
          <RecoBillboardSlot />
        </div>

        {overview.state === "warming" && (
          <p className="row-gutter mb-6 text-sm text-content-tertiary">{t("warmingHint")}</p>
        )}

        {/* Bandeau d'affinage : des rangées sont là mais mieux arrive. */}
        {overview.refining && overview.rows.length > 0 && (
          <p className="row-gutter mb-6 text-sm text-content-tertiary">{t("preliminaryHint")}</p>
        )}

        {overview.generating && overview.rows.length === 0 ? (
          <>
            <p className="row-gutter mb-6 text-sm text-content-tertiary">{t("generatingHint")}</p>
            <RecoRowSkeleton />
            <RecoRowSkeleton />
            <RecoRowSkeleton />
          </>
        ) : (
          overview.rows.map((row, i) => (
            <RecoRowSlot
              key={row.key}
              rowKey={row.key}
              seedTitle={row.seedTitle}
              animDelay={150 + i * 80}
              excludeKeys={row.key === "forYou" ? excludeKeys : undefined}
              pendingFallback="skeleton"
            />
          ))
        )}
      </div>
    </PageTransition>
  );
}
