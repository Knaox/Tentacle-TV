import { DesktopPlayerError } from "../../components/player/DesktopPlayerFallback";
import { FallbackPlayerBanner } from "../../components/player/FallbackPlayerBanner";
import { MediaMissingScreen } from "../../components/player/MediaMissingScreen";
import { PlayerLoadingScreen } from "../../components/player/PlayerLoadingScreen";
import { labImages, labParam } from "./labFixtures";
import { LabStage } from "./labStage";

const noop = () => {};

/**
 * Les écrans où le lecteur n'a pas (ou plus) d'image : l'attente avant la première image, le
 * fichier introuvable, l'erreur du lecteur natif, et le bandeau de la bascule de secours.
 */
export function LabScreens() {
  const state = labParam("etat") ?? "chargement";
  if (state === "introuvable") return <div data-lab-stage><MediaMissingScreen onRetry={noop} onBack={noop} /></div>;
  if (state === "erreur") {
    return <div data-lab-stage><DesktopPlayerError failure={{ kind: "player", detail: "loadfile : échec" } as never} onBack={noop} /></div>;
  }
  if (state === "secours") return <LabStage><FallbackPlayerBanner /></LabStage>;
  return (
    <div data-lab-stage>
      <PlayerLoadingScreen posterUrl={labImages().backdrop} title="Caminandes" subtitle="S1 · É2 — Gran Dillama" onCancel={noop} />
    </div>
  );
}
