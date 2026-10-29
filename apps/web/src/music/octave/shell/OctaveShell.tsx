/**
 * Octave — le cadre du mode. Bureau : le rail de navigation à gauche, la page
 * au centre avec le DOCK qui flotte au-dessus d'elle (la page défile dessous),
 * la file d'attente en îlot à droite. Téléphone : en-tête, page, mini-lecteur
 * et onglets flottants (`touch/OctavePhoneShell`). Tablette : en portrait un
 * rail d'icônes (`touch/OctaveCompactRail`), en paysage la barre latérale ; la
 * file en tiroir par-dessus la page (`touch/octaveLayout`). Le lecteur
 * « en cours » s'ouvre par-dessus tout.
 *
 * Le bandeau d'hôte de macOS (feux tricolores) garde sa place
 * (`--hote-bandeau`), comme dans la coquille vidéo.
 *
 * Liquid Glass (mode natif, bureau) : la MÊME disposition, aux mêmes tailles (le
 * verre change le matériau, jamais les dimensions — Damien, 26/10) ; la coquille
 * reçoit seulement le fond ambiant (`glass/OctaveAmbient`, teinté par la pochette)
 * et la classe `octave-stage` que lisent les peaux de `glass/*.css`. Ailleurs,
 * rien ne change.
 */

import { PlaylistManageHost } from "../playlists/PlaylistManageHost";
import "./touch/octaveTouch.css";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDisplayedSurface } from "../../../theme/displayedSurface";
import { useLiquidGlassMode } from "../../../theme/glass";
import { OctaveAmbient } from "../glass/OctaveAmbient";
import { OctaveGlassStageContext } from "../glass/glassStage";
import { DuplicateConfirmHost } from "../actions/duplicateConfirm";
import { PlaylistChooserHost } from "../actions/playlistChooser";
import { UnavailableAlbumHost } from "../actions/UnavailableAlbumDialog";
import { ImportPlaylistHost } from "../import/ImportPlaylistHost";
import { ReleaseImportHost } from "../releases/ReleaseImportHost";
import { BulkDuplicateHost } from "../actions/selection/bulkDuplicateConfirm";
import { useOctaveEvents } from "../events/useOctaveEvents";
import { useQueueLibraryTwins } from "../library/useQueueLibraryTwins";
import { NowPlayingSheet } from "./NowPlayingSheet";
import { OctaveSidebar } from "./OctaveSidebar";
import { PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";
import { OctaveCompactRail } from "./touch/OctaveCompactRail";
import { OctavePhoneShell } from "./touch/OctavePhoneShell";
import { isTabletLayout } from "./touch/octaveLayout";
import { useOctaveLayout } from "./touch/useOctaveLayout";
import { useAlbumWarmupSink } from "../data/albumWarmup";

interface OctaveShellProps {
  children: ReactNode;
  onExit: () => void;
}

/** La place que le dock flottant prend au bas de la page : rien ne reste caché dessous. */
const DOCK_ROOM = "calc(var(--oc-dock-height) + var(--oc-dock-inset) * 2 + 16px)";

/** Une nouvelle page s'ouvre en haut. */
function useResetScroll(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [main, pathname]);
}

export function OctaveShell({ children, onExit }: OctaveShellProps) {
  const { t } = useTranslation("music");
  const layout = useOctaveLayout();
  const native = useLiquidGlassMode() === "native";
  const [queueOpen, setQueueOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  // Les albums vus défiler (toutes les pages, large ou étroite) : préparés à l'arrêt (`data/albumWarmup.ts`).
  useAlbumWarmupSink();
  const toggleQueue = useCallback(() => setQueueOpen((v) => !v), []);
  const closeQueue = useCallback(() => setQueueOpen(false), []);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  // Octave affiché : SON apparence (thème, Liquid Glass), réglée à part de celle de Tentacle.
  useDisplayedSurface("octave");
  useOctaveEvents();
  // La file : un titre d'ailleurs que la bibliothèque a devient le sien, à sa place.
  useQueueLibraryTwins();
  useResetScroll(main);

  const overlays = (
    <>
      {sheetOpen && <NowPlayingSheet onClose={closeSheet} />}
      <ShellHosts />
    </>
  );

  if (layout === "phone") {
    return (
      <OctavePhoneShell main={main} onExit={onExit} onOpenNowPlaying={openSheet} overlays={overlays}>
        {children}
      </OctavePhoneShell>
    );
  }

  const tablet = isTabletLayout(layout);
  return (
    <OctaveGlassStageContext.Provider value={native}>
    <div className={`fixed inset-0 flex bg-octave-ink${native ? " octave-stage" : ""}`} style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell={tablet ? layout : "desktop"}>
      {native && <OctaveAmbient />}
      {layout === "tablet-rail" ? <OctaveCompactRail onExit={onExit} /> : <OctaveSidebar onExit={onExit} />}
      <div className="relative min-w-0 flex-1">
        <main ref={main} id="octave-main" className="h-full overflow-y-auto overscroll-contain" style={{ paddingBottom: DOCK_ROOM }}>
          {children}
        </main>
        <div aria-hidden className="octave-dock-edge" />
        <PlayerBar queueOpen={queueOpen} onToggleQueue={toggleQueue} onOpenNowPlaying={openSheet} />
      </div>
      {queueOpen && (
        // Tablette : un tiroir PAR-DESSUS la page (une colonne de plus l'écraserait), fermé au toucher du voile.
        <>
          {tablet && <button type="button" aria-label={t("queue.close")} className="octave-veil fixed inset-0 z-30 cursor-default" onClick={closeQueue} />}
          <div className={`octave-drawer octave-island overflow-hidden ${tablet ? "fixed bottom-2 right-2 top-2 z-40 w-[min(var(--oc-queue-width),calc(100vw-96px))]" : "my-2 mr-2 w-[var(--oc-queue-width)] shrink-0"}`}>
            <QueuePanel onClose={closeQueue} />
          </div>
        </>
      )}
      {overlays}
    </div>
    </OctaveGlassStageContext.Provider>
  );
}

/** Les confirmations et le choix d'une playlist, montés une fois par coquille. */
function ShellHosts() {
  return (
    <>
      <DuplicateConfirmHost />
      <PlaylistChooserHost />
      <UnavailableAlbumHost />
      <BulkDuplicateHost />
      <ImportPlaylistHost />
      <ReleaseImportHost />
      <PlaylistManageHost />
    </>
  );
}
