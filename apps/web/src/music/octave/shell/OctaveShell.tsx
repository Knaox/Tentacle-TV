/**
 * Octave — le cadre du mode. Bureau : le rail de navigation à gauche, la page
 * au centre avec le DOCK qui flotte au-dessus d'elle (la page défile dessous),
 * la file d'attente en îlot à droite. Téléphone : en-tête, page, mini-lecteur,
 * onglets. Le lecteur « en cours » s'ouvre par-dessus tout.
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

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useDisplayedSurface } from "../../../theme/displayedSurface";
import { useLiquidGlassMode } from "../../../theme/glass";
import { OctaveAmbient } from "../glass/OctaveAmbient";
import { OctaveGlassStageContext } from "../glass/glassStage";
import { DuplicateConfirmHost } from "../actions/duplicateConfirm";
import { PlaylistChooserHost } from "../actions/playlistChooser";
import { BulkDuplicateHost } from "../actions/selection/bulkDuplicateConfirm";
import { useOctaveEvents } from "../events/useOctaveEvents";
import { useQueueLibraryTwins } from "../library/useQueueLibraryTwins";
import { HistoryButtons } from "./HistoryButtons";
import { NowPlayingSheet } from "./NowPlayingSheet";
import { OctaveModeSlot } from "./OctaveModeSlot";
import { OctaveProfileButton } from "../profiles";
import { OctaveSidebar, OctaveTabBar } from "./OctaveSidebar";
import { OctaveWordmark } from "./OctaveWordmark";
import { MiniPlayer, PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";

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
  const mobile = useIsMobile();
  const native = useLiquidGlassMode() === "native";
  const [queueOpen, setQueueOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
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

  if (mobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-octave-ink" style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="mobile">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top,0px)]">
          <HistoryButtons compact />
          <div className="min-w-0 flex-1 px-2">
            <OctaveWordmark logoSize={28} className="text-xl" />
          </div>
          <OctaveModeSlot onExit={onExit} compact />
          <OctaveProfileButton compact />
        </header>
        <main ref={main} id="octave-main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {children}
        </main>
        <div className="shrink-0 pb-2">
          <MiniPlayer onOpen={openSheet} />
        </div>
        <OctaveTabBar />
        {sheetOpen && <NowPlayingSheet onClose={closeSheet} />}
        <ShellHosts />
      </div>
    );
  }

  return (
    <OctaveGlassStageContext.Provider value={native}>
    <div className={`fixed inset-0 flex bg-octave-ink${native ? " octave-stage" : ""}`} style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="desktop">
      {native && <OctaveAmbient />}
      <OctaveSidebar onExit={onExit} />
      <div className="relative min-w-0 flex-1">
        <main ref={main} id="octave-main" className="h-full overflow-y-auto overscroll-contain" style={{ paddingBottom: DOCK_ROOM }}>
          {children}
        </main>
        <div aria-hidden className="octave-dock-edge" />
        <PlayerBar queueOpen={queueOpen} onToggleQueue={toggleQueue} onOpenNowPlaying={openSheet} />
      </div>
      {queueOpen && (
        <div className="octave-drawer octave-island my-2 mr-2 w-[var(--oc-queue-width)] shrink-0 overflow-hidden">
          <QueuePanel onClose={closeQueue} />
        </div>
      )}
      {sheetOpen && <NowPlayingSheet onClose={closeSheet} />}
      <ShellHosts />
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
      <BulkDuplicateHost />
    </>
  );
}
