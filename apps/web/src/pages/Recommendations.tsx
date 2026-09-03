import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useRecoOverview } from "@tentacle-tv/api-client";
import { Shimmer } from "@tentacle-tv/ui";
import { PageTransition } from "../components/PageTransition";
import { ColdStart } from "../components/reco/ColdStart";
import { RecoBillboardSlot } from "../components/reco/hero/RecoBillboardSlot";
import { useRecoHeroSlides } from "../components/reco/hero/recoHeroSlides";
import { LikedActorsPanel } from "../components/reco/LikedActorsPanel";
import { RecoFiltersMenu } from "../components/reco/RecoFiltersMenu";
import { RecoRowSkeleton } from "../components/reco/RecoRowSkeleton";
import { RecoRowSlot } from "../components/reco/RecoRowSlot";
import { RecoStatusBanner } from "../components/reco/RecoStatusBanner";
import { hasColdStartAck, markColdStartAck } from "../lib/coldStartAck";
import { useRecoFilter, useRecoFilterServerSync } from "../hooks/useRecoFilter";

/** Les rangées servies dans TOUS les états du moteur (contrat backend). */
const GLOBAL_ROW_KEYS = new Set(["trending", "serverPulse", "bestOfLibrary"]);

/**
 * Page Recommandations. Toute la matière vient du backend (pool + rangées
 * dérivées) ; la page choisit seulement quoi montrer selon l'état du moteur.
 * Elle n'est plus JAMAIS vide : les rangées globales (tendances, pouls du
 * serveur, mieux notés de la bibliothèque) tiennent la scène dans tous les
 * états — perso coupée, clé TMDB absente, profil froid ou en construction —
 * et un bandeau unique (RecoStatusBanner) dit ce qui se passe.
 * Une rangée vide ne rend RIEN (dégradé silencieux, jamais d'erreur).
 */
export function Recommendations() {
  const { t } = useTranslation("reco");
  const { data: overview, isPending } = useRecoOverview();
  // Même clé de cache que la rangée « Pour vous » : zéro requête en plus.
  const { excludeKeys } = useRecoHeroSlides();
  // Le filtre de plateformes vit dans son store (miroir local + réglage du
  // compte, synchronisé ici) — la page filtrée arrive par le serveur.
  useRecoFilterServerSync();
  const { selected: selectedProviders } = useRecoFilter();
  const providerFilter = selectedProviders.length > 0 ? selectedProviders : undefined;
  // Le démarrage à froid est COLLANT : une fois affiché (« hold »), il ne cède
  // l'écran qu'au bouton « Voir mes recommandations » — jamais à un refetch
  // d'arrière-plan en pleine sélection. « dismissed » survit tant que le
  // serveur dit encore « cold » (la bascule est instantanée, le profil se
  // reconstruit derrière) : sans lui, la grille se ré-afficherait une seconde
  // après le clic. L'état se réarme dès que le serveur a vraiment tourné.
  // Et il ne s'IMPOSE qu'une fois (accusé par compte et par appareil) : les
  // visites suivantes passent par le bandeau CTA, jamais par le plein écran.
  const [phase, setPhase] = useState<"auto" | "hold" | "dismissed">("auto");
  useEffect(() => {
    if (overview?.state === "cold") {
      setPhase((p) =>
        p === "auto" && overview.tmdbConfigured !== false && !hasColdStartAck() ? "hold" : p
      );
    } else {
      setPhase("auto");
    }
  }, [overview?.state, overview?.tmdbConfigured]);
  // L'accusé se pose dès que la grille a été VUE — « Plus tard » compte aussi.
  useEffect(() => {
    if (phase === "hold") markColdStartAck();
  }, [phase]);

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

  // Vieux serveur qui n'annonce AUCUNE rangée en mode désactivé : l'écran
  // historique demeure. Un serveur à jour sert les rangées globales, et la
  // page ci-dessous les rend avec le bandeau explicatif.
  if (overview.state === "disabled" && overview.rows.length === 0) {
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

  const hasPersonalizedRows = overview.rows.some((r) => !GLOBAL_ROW_KEYS.has(r.key));
  const canPersonalize = overview.personalized !== false && overview.tmdbConfigured !== false;

  return (
    <PageTransition>
      <div className="min-h-screen pb-20">
        {/* Le héros n'est PAS filtré par les chips : stabilité visuelle. Tant
            que la reco n'a rien à montrer (générique, froid, en construction),
            un en-tête compact tient sa place — jamais de carrousel
            « Sélectionné pour vous » nourri de contenu générique. */}
        <RecoBillboardSlot
          fallback={
            <div className="row-gutter pb-2 pt-8">
              <h1 className="text-2xl font-bold text-content-primary">{t("pageTitle")}</h1>
            </div>
          }
        />

        <RecoFiltersMenu />

        <RecoStatusBanner
          overview={overview}
          hasPersonalizedRows={hasPersonalizedRows}
          onOpenColdStart={() => setPhase("hold")}
        />

        {overview.generating && overview.rows.length === 0 ? (
          <>
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
              providerFilter={providerFilter}
              pendingFallback="skeleton"
            />
          ))
        )}

        {/* Ajuster ses acteurs se fait ICI, au contact des rangées — pas dans
            les réglages. Visible aussi pendant l'exploration : aimer deux ou
            trois acteurs nourrit le profil qui se construit. Masqué quand la
            personnalisation est indisponible (perso coupée, pas de clé TMDB :
            la recherche de personnes serait une impasse). */}
        {canPersonalize && <LikedActorsPanel />}
      </div>
    </PageTransition>
  );
}
