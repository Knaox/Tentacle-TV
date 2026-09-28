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
import { WifiOff } from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { CARD_HEIGHT, FRAME_GUTTER } from "../components/hero/HeroBillboard";
import { useOfflineMode } from "../offline/useOfflineMode";
import { DownloadsEmptyState } from "./DownloadsEmptyState";
import { OfflineDeviceSummary } from "./OfflineDeviceSummary";
import { OfflineBillboard } from "./home/OfflineBillboard";
import { OfflineCardRow } from "./home/OfflineCardRow";
import { OfflineLibrarySection } from "./home/OfflineLibrarySection";
import { useEntriesWithBackdrop } from "./home/useEntriesWithBackdrop";
import { ALL_LIBRARIES, useOfflineHome, type OfflineHomeFilter } from "./home/useOfflineHome";

export function OfflineCatalog() {
  const { t } = useTranslation(["downloads", "common"]);
  const offline = useOfflineMode();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OfflineHomeFilter>(ALL_LIBRARIES);
  const home = useOfflineHome(search, filter);
  const billboard = useEntriesWithBackdrop(home.hero);

  // Le dernier titre d'une bibliothèque filtrée vient de partir : retour à « Tout ».
  useEffect(() => {
    if (filter !== ALL_LIBRARIES && !home.libraries.some((library) => library.id === filter)) setFilter(ALL_LIBRARIES);
  }, [filter, home.libraries]);

  if (home.ready && home.complete.length === 0) {
    return (
      <PageTransition className="px-4 pb-24 pt-10 md:px-8">
        <h1 className="sr-only">{t("downloads:heroLabel")}</h1>
        {offline ? <OfflineEmpty /> : <DownloadsEmptyState />}
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <h1 className="sr-only">{t("downloads:heroLabel")}</h1>
      {!billboard.settled || !home.ready ? (
        // Le temps d'une sonde (quelques millisecondes) : le cadre de la
        // bannière, pour que rien ne saute quand elle arrive.
        <div className={`pb-6 md:pb-10 ${FRAME_GUTTER}`}>
          <div className={`skeleton-shimmer w-full ${CARD_HEIGHT}`} style={{ borderRadius: "var(--hero-frame-radius)" }} />
        </div>
      ) : (
        billboard.entries.length > 0 && <OfflineBillboard entries={billboard.entries} />
      )}

      <div className="relative z-10 space-y-10 pb-24">
        <OfflineDeviceSummary complete={home.complete} />
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

/** Hors ligne, et rien sur la machine : le catalogue reviendra avec le serveur. */
function OfflineEmpty() {
  const { t } = useTranslation("downloads");
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line-subtle bg-fill-faint text-[var(--brand-light)]">
        <WifiOff className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-5 text-lg font-semibold text-content-primary">{t("offlineEmptyTitle")}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-content-tertiary">{t("offlineEmptyMessage")}</p>
    </div>
  );
}
