/**
 * L'accueil du mode Hors ligne — et la page « Sur cet appareil » quand le
 * serveur répond (`/on-device`).
 *
 * Il se lit comme l'accueil en ligne : la même bannière encadrée (les titres
 * de la machine, reprises d'abord), un résumé de ce que la machine porte, les
 * rangées « Reprendre la lecture » et « À suivre » tirées de la progression
 * locale, puis tout le catalogue en grilles, cherchable et filtrable par
 * bibliothèque d'origine. Les cartes sont celles du reste de l'app — même
 * repos, même survol —, en mode local : seule la coche « vu » s'y bascule.
 *
 * Tout vient du disque : cette page ne coûte pas un octet de réseau. Seuls les
 * titres COMPLETS et lisibles du compte y paraissent.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { WifiSlashIcon as WifiOff } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { PageTransition } from "../components/PageTransition";
import { BackButton } from "../components/ui/BackButton";
import { CARD_HEIGHT, FRAME_GUTTER } from "../components/hero/HeroBillboard";
import { useOfflineMode } from "../offline/useOfflineMode";
import { usePullOnCatalogOpen } from "../offline/usePlaybackPull";
import { ProfileOfflineScreen } from "../offline/ProfileOfflineScreen";
import { useActiveProfile } from "../auth/profileSession";
import { DownloadsEmptyState } from "./DownloadsEmptyState";
import { OfflineMusicEntry, OfflineMusicOrEmpty } from "../music/octave/offline/OfflineMusicEntry";
import { OfflineDeviceSummary } from "./OfflineDeviceSummary";
import { OfflineBillboard } from "./home/OfflineBillboard";
import { OfflineCardRow } from "./home/OfflineCardRow";
import { OfflineLibrarySection } from "./home/OfflineLibrarySection";
import { useEntriesWithBackdrop } from "./home/useEntriesWithBackdrop";
import { ALL_LIBRARIES, useOfflineHome, type OfflineHomeFilter } from "./home/useOfflineHome";

export function OfflineCatalog() {
  const profileSession = useActiveProfile() !== null;
  const offline = useOfflineMode();
  if (!profileSession) return <DeviceCatalog />;
  // Session d'un PROFIL : le hors ligne est au compte de l'appareil — le disque
  // n'est même pas lu. En ligne, « Sur cet appareil » n'existe pas pour lui ;
  // hors ligne, le bureau revient au compte (`offline/accountFallback.ts`) et le
  // navigateur, qui ne le peut pas sans le serveur, attend.
  return offline ? <ProfileOfflineScreen /> : <Navigate to="/" replace />;
}

function DeviceCatalog() {
  const { t } = useTranslation(["downloads", "common"]);
  const offline = useOfflineMode();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OfflineHomeFilter>(ALL_LIBRARIES);
  const home = useOfflineHome(search, filter);
  const billboard = useEntriesWithBackdrop(home.hero);
  // « Sur cet appareil » ouvert en ligne : ce qui a été vu ailleurs entre ici.
  usePullOnCatalogOpen();

  // Le dernier titre d'une bibliothèque filtrée vient de partir : retour à « Tout ».
  useEffect(() => {
    if (filter !== ALL_LIBRARIES && !home.libraries.some((library) => library.id === filter)) setFilter(ALL_LIBRARIES);
  }, [filter, home.libraries]);

  // Hors ligne, ce catalogue EST l'accueil (une racine) ; en ligne, c'est la page
  // « Sur cet appareil » : on en revient par le bouton Retour.
  const showBack = !offline;
  const hasBillboard = billboard.settled && home.ready && billboard.entries.length > 0;

  if (home.ready && home.complete.length === 0) {
    return (
      <PageTransition className="px-4 pb-24 pt-10 md:px-8">
        {showBack ? <CatalogHeading title={t("downloads:heroLabel")} /> : <h1 className="sr-only">{t("downloads:heroLabel")}</h1>}
        {offline ? (
          <OfflineMusicOrEmpty fallback={<OfflineEmpty />} />
        ) : (
          <>
            <DownloadsEmptyState />
            <div className="mt-10"><OfflineMusicEntry /></div>
          </>
        )}
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {/* Sans bannière pour le porter, le Retour a sa ligne en tête de page. */}
      {showBack && billboard.settled && home.ready && !hasBillboard ? (
        <div className="row-gutter pt-6"><CatalogHeading title={t("downloads:heroLabel")} /></div>
      ) : (
        <h1 className="sr-only">{t("downloads:heroLabel")}</h1>
      )}
      {!billboard.settled || !home.ready ? (
        // Le temps d'une sonde (quelques millisecondes) : le cadre de la
        // bannière, pour que rien ne saute quand elle arrive.
        <div className={`pb-6 md:pb-10 ${FRAME_GUTTER}`}>
          <div className={`skeleton-shimmer w-full ${CARD_HEIGHT}`} style={{ borderRadius: "var(--hero-frame-radius)" }} />
        </div>
      ) : (
        billboard.entries.length > 0 && <OfflineBillboard entries={billboard.entries} back={showBack} />
      )}

      <div className="relative z-10 space-y-10 pb-24">
        <OfflineDeviceSummary complete={home.complete} />
        <OfflineMusicEntry />
        <OfflineCardRow title={t("common:resumeWatching")} entries={home.resume} />
        <OfflineCardRow title={t("common:nextEpisode")} entries={home.nextUp} />
        <OfflineLibrarySection
          search={search}
          onSearch={setSearch}
          filter={filter}
          onFilter={setFilter}
          libraries={home.libraries}
          movies={home.movies}
          series={home.series}
        />
      </div>
    </PageTransition>
  );
}

/** La ligne de tête d'une page sans bannière : le Retour et le titre, en clair. */
function CatalogHeading({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3.5">
      <BackButton />
      <h1 className="font-display text-display-3 text-content-primary">{title}</h1>
    </div>
  );
}

/** Hors ligne, et rien sur la machine : le catalogue reviendra avec le serveur. */
function OfflineEmpty() {
  const { t } = useTranslation("downloads");
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-tile bg-surface-2 text-content-secondary">
        <WifiOff size={26} aria-hidden />
      </span>
      <p className="font-display text-heading-3 text-content-primary">{t("offlineEmptyTitle")}</p>
      <p className="max-w-[52ch] text-sm leading-relaxed text-content-secondary">{t("offlineEmptyMessage")}</p>
    </div>
  );
}
