import { useMemo, useState } from "react";
import { PictureInPictureContext, type PictureInPicture } from "../../pictureInPicture/pictureInPictureContext";
import { PipControls } from "../../pictureInPicture/PipControls";
import { labImages, labParam } from "./labFixtures";

const nothing = (): void => undefined;

/**
 * Le PiP du bureau, dans un cadre à sa taille : les vrais contrôles (`PipControls`) sur une image
 * fixe. `?etat=chargement` : la vue d'attente ; `?etat=ancre` : épinglé dans le coin.
 */
export function LabPip() {
  const state = labParam("etat") ?? "lecture";
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(true);
  const pip = useMemo<PictureInPicture>(() => ({
    supported: true, active: true, mode: state === "ancre" ? "docked" : "floating",
    container, frame: { shadow: 14, bezel: 3 },
    reduce: nothing, expand: nothing, close: nothing, setMode: nothing, resizeBy: nothing, gesture: nothing, navigateInPip: nothing,
  }), [container, state]);
  const images = labImages();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0" data-lab-stage>
      <div ref={setContainer} className="relative overflow-hidden" style={{ width: 480, height: 270 + 28 }}>
        {images.backdrop && (
          <img src={images.backdrop} alt="" className="absolute object-cover" style={{ inset: 17, width: "calc(100% - 34px)", height: "calc(100% - 34px)", borderRadius: 10 }} />
        )}
        <PictureInPictureContext.Provider value={pip}>
          <PipControls
            paused={paused} position={88} duration={190} title="Caminandes — S1 · É2 — Gran Dillama"
            onTogglePause={() => setPaused((p) => !p)} onSkip={nothing}
            loading={state === "chargement" ? { posterUrl: images.backdropNext, title: "Caminandes — S1 · É3" } : null}
          />
        </PictureInPictureContext.Provider>
      </div>
    </div>
  );
}
