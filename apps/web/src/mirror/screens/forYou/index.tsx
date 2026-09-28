import { Suspense, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { activeFamilyCount, buildPlatformCatalog, useJellyfinClient, useWatchProviders } from "@tentacle-tv/api-client";
import { PLATFORM_FAMILIES } from "@tentacle-tv/shared";
import { SwipeSection } from "../../../lazyPages";
import { RecoSectionSwitch } from "../../../components/reco/RecoSectionSwitch";
import { RecoRefineTeaser } from "../../../components/reco/RecoRefineTeaser";
import { useRecoNavigation } from "../../../lib/recoNavigation";
import { recoSectionOf } from "../../../lib/recoSections";
import { HeroBanner } from "../../hero/HeroBanner";
import { SkeletonHeroScreen } from "../../hero/Skeletons";
import { SubtleBackground } from "../../hero/SubtleBackground";
import { ColdStartScreen } from "./ColdStartScreen";
import { LikedActorsPanel } from "./LikedActorsPanel";
import { recoHeroSlides } from "./RecoHeroContent";
import { RecoFilterSheet } from "./RecoFilterSheet";
import { RecoDisabledState, RecoErrorState, RecoPageHeader, RecoPageRows, RecoStatusBanner } from "./RecoPageParts";
import { useItemSheets } from "./useItemSheets";
import { useRecoPageModel } from "./useRecoPageModel";
import "../../mirror.css";

/**
 * L'onglet Pour vous : ses deux sections sous un segment — « Pour vous »
 * (ci-dessous) et « Affiner », la pile de swipe partagée avec le bureau.
 */
export function MirrorForYou() {
  const section = recoSectionOf(useLocation().pathname);
  return (
    <SubtleBackground>
      <div className="px-4 pb-3 pt-3">
        <RecoSectionSwitch section={section} />
      </div>
      {section === "refine" ? (
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <SwipeSection />
        </Suspense>
      ) : (
        <MirrorForYouSection />
      )}
    </SubtleBackground>
  );
}

/**
 * La section Pour vous de l'app (`ForYouScreen`) : la page de recommandations
 * rendue d'un coup depuis la page servie — carrousel tiré de « Pour vous »
 * (sinon le titre compact), bouton Filtres et sa feuille, bandeau d'état,
 * rangées avec leur raison, « Vos acteurs ». Sans page : squelettes ou
 * l'erreur ; démarrage à froid : la grille ; vieux serveur désactivé :
 * l'écran historique.
 */
function MirrorForYouSection() {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const model = useRecoPageModel();
  const recoNav = useRecoNavigation();
  const { openReco, sheets } = useItemSheets();

  const heroSlides = useMemo(
    () => recoHeroSlides(model.hero.slides, client, { canOpen: recoNav.canOpen, onOpen: recoNav.open }),
    [model.hero.slides, client, recoNav.canOpen, recoNav.open],
  );

  // Le catalogue des familles présentes dans la région, et le compteur du bouton.
  const providers = useWatchProviders();
  const catalog = useMemo(() => buildPlatformCatalog(PLATFORM_FAMILIES, providers.data), [providers.data]);
  const activeCount = activeFamilyCount(catalog, model.providerFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const openSettings = useCallback(() => navigate("/settings/personalization"), [navigate]);
  const { dismissColdStart } = model;
  const later = useCallback(() => {
    dismissColdStart();
    navigate("/");
  }, [dismissColdStart, navigate]);

  const { page } = model;
  let body;
  if (!page) {
    body = model.isError ? <RecoErrorState onRetry={model.retry} /> : <SkeletonHeroScreen rows={2} />;
  } else if (page.state === "disabled" && page.rows.length === 0) {
    body = <RecoDisabledState onOpenSettings={openSettings} />;
  } else if (model.phase === "hold") {
    body = <ColdStartScreen signalCount={page.signalCount} onDone={dismissColdStart} onLater={later} />;
  } else {
    body = (
      <>
        {heroSlides.length > 0 && <HeroBanner slides={heroSlides} />}
        <RecoPageHeader showTitle={heroSlides.length === 0} filterCount={activeCount} onOpenFilters={openFilters} />
        <RecoStatusBanner
          page={page}
          hasPersonalizedRows={model.hasPersonalizedRows}
          onOpenColdStart={model.openColdStart}
          onOpenSettings={openSettings}
        />
        <RecoPageRows
          page={page}
          filtered={model.filtered}
          stale={model.stale}
          teaser={page.personalized !== false ? <RecoRefineTeaser className="mt-6 px-4" /> : undefined}
          canOpen={recoNav.canOpen}
          onItemPress={recoNav.open}
          onItemLongPress={openReco}
        />
        {/* Ajuster ses acteurs se fait ICI — masqué sans personnalisation possible. */}
        {model.canPersonalize && <LikedActorsPanel />}
        <RecoFilterSheet open={filtersOpen} onClose={closeFilters} catalog={catalog} />
        {sheets}
      </>
    );
  }

  return body;
}
