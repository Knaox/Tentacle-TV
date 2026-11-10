import { useMemo } from "react";
import { findRelease } from "../../whatsNew/releases";
import type { WhatsNewSelection } from "../../whatsNew/selectFeatures";
import { WhatsNewScreen } from "../../whatsNew/WhatsNewScreen";
import { labParam } from "./labFixtures";

const noop = () => {};

/**
 * L'écran des nouveautés, avec une VRAIE version du registre (`?version=`, 1.30.0 par défaut :
 * la plus fournie) — son cadre (liste, scène, pied) est celui de la refonte ; les scènes sont
 * les illustrations d'époque de chaque version.
 */
export function LabWhatsNew() {
  const version = labParam("version") ?? "1.30.0";
  const selection = useMemo<WhatsNewSelection | null>(() => {
    const release = findRelease(version);
    if (!release || release.features.length === 0) return null;
    return {
      features: release.features.map((feature) => ({ ...feature, version: release.version })),
      from: null, to: release.version, spansReleases: false,
    };
  }, [version]);
  return (
    <div className="min-h-screen bg-surface-0 p-10 text-content-primary" data-lab-stage>
      <h1 className="text-display-3">Nouveautés</h1>
      <WhatsNewScreen open selection={selection} onClose={noop} />
    </div>
  );
}
