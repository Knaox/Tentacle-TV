/**
 * Octave — la coquille du TÉLÉPHONE (navigateur d'un téléphone, fenêtre étroite
 * du bureau) : la grammaire de l'app mobile et du miroir. En haut, l'en-tête
 * (‹, la marque, « Sur cet appareil », la bascule du mode, le profil) ; la page défile DESSOUS ; en
 * bas, le mini-lecteur et la barre d'onglets FLOTTENT au-dessus d'elle, dans la
 * zone sûre. Rien ne reste caché sous eux : la page réserve leur place. Les
 * rangées de titre y sont COMPACTES (`components/compactRows`).
 */

import type { ReactNode, RefObject } from "react";
import { CompactRowsContext } from "../../components/compactRows";
import { DeviceHeaderButton } from "../../offline/DeviceNavItem";
import { usePlayerSelector } from "../../player/OctavePlayerProvider";
import { OctaveProfileButton } from "../../profiles";
import { HistoryButtons } from "../HistoryButtons";
import { OctaveModeSlot } from "../OctaveModeSlot";
import { OctaveWordmark } from "../OctaveWordmark";
import { MiniPlayer } from "../PlayerBar";
import { OctaveFloatingTabs } from "./OctaveFloatingTabs";
import { phoneBottomRoom, PHONE_BOTTOM_INSET } from "./phoneMetrics";

interface OctavePhoneShellProps {
  children: ReactNode;
  main: RefObject<HTMLElement | null>;
  onExit: () => void;
  onOpenNowPlaying: () => void;
  /** Le lecteur « en cours » et les hôtes, montés par la coquille commune. */
  overlays: ReactNode;
}

export function OctavePhoneShell({ children, main, onExit, onOpenNowPlaying, overlays }: OctavePhoneShellProps) {
  const playing = usePlayerSelector((s) => s.current !== null);
  return (
    <div className="fixed inset-0 bg-octave-ink" style={{ paddingTop: "var(--hote-bandeau, 0px)" }} data-octave-shell="mobile">
      <main
        ref={main}
        id="octave-main"
        className="octave-phone-main h-full overflow-y-auto overscroll-contain"
        style={{ paddingBottom: phoneBottomRoom(playing) }}
      >
        <header
          className="octave-phone-header sticky top-0 z-20 flex items-center gap-1 px-2"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingLeft: "max(8px, env(safe-area-inset-left, 0px))", paddingRight: "max(8px, env(safe-area-inset-right, 0px))" }}
        >
          <div className="flex h-14 min-w-0 flex-1 items-center gap-1">
            <HistoryButtons compact />
            <div className="min-w-0 flex-1 px-1">
              <OctaveWordmark logoSize={28} className="text-xl" />
            </div>
            <DeviceHeaderButton />
            <OctaveModeSlot onExit={onExit} compact />
            <OctaveProfileButton compact />
          </div>
        </header>
        <CompactRowsContext.Provider value={true}>{children}</CompactRowsContext.Provider>
      </main>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3"
        style={{
          paddingBottom: `max(env(safe-area-inset-bottom, 0px), ${PHONE_BOTTOM_INSET}px)`,
          paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
          paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="pointer-events-auto">
          <MiniPlayer onOpen={onOpenNowPlaying} />
        </div>
        <OctaveFloatingTabs />
      </div>
      {overlays}
    </div>
  );
}
