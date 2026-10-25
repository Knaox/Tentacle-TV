/**
 * Octave — le cadre du mode : barre latérale, page, file d'attente, barre de
 * lecture (bureau) ; page, mini-lecteur, onglets (téléphone). La page défile
 * seule, le lecteur reste en place.
 *
 * Le bandeau d'hôte de macOS (feux tricolores) garde sa place
 * (`--hote-bandeau`), comme dans la coquille vidéo.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useOctaveEvents } from "../events/useOctaveEvents";
import { OctaveModeSwitch } from "../mode/OctaveModeSwitch";
import { NowPlayingSheet } from "./NowPlayingSheet";
import { OctaveSidebar, OctaveTabBar, OctaveWordmark } from "./OctaveSidebar";
import { MiniPlayer, PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";

interface OctaveShellProps {
  children: ReactNode;
  onExit: () => void;
}

/** Une nouvelle page s'ouvre en haut ; le focus passe à son contenu (lecteurs d'écran). */
function useResetScroll(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [main, pathname]);
}

export function OctaveShell({ children, onExit }: OctaveShellProps) {
  const mobile = useIsMobile();
  const [queueOpen, setQueueOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const toggleQueue = useCallback(() => setQueueOpen((v) => !v), []);
  const closeQueue = useCallback(() => setQueueOpen(false), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useOctaveEvents();
  useResetScroll(main);

  if (mobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-surface-0" style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="mobile">
        <header className="flex h-14 shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]">
          <OctaveWordmark className="text-xl" logoSize={30} />
          <OctaveModeSwitch placement="octave" onExit={onExit} />
        </header>
        <main ref={main} id="octave-main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {children}
        </main>
        <div className="shrink-0 pb-2">
          <MiniPlayer onOpen={() => setSheetOpen(true)} />
        </div>
        <OctaveTabBar />
        {sheetOpen && <NowPlayingSheet onClose={closeSheet} />}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-surface-0" style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="desktop">
      <div className="flex min-h-0 flex-1">
        <OctaveSidebar onExit={onExit} />
        <main ref={main} id="octave-main" className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
        {queueOpen && (
          <div className="octave-drawer w-[340px] shrink-0 border-l border-line-subtle bg-surface-1">
            <QueuePanel onClose={closeQueue} />
          </div>
        )}
      </div>
      <PlayerBar queueOpen={queueOpen} onToggleQueue={toggleQueue} />
    </div>
  );
}
