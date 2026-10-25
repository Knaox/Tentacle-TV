/**
 * Octave — les houles qui lisent ELLES-MÊMES le lecteur : on les monte d'une
 * ligne là où l'on sait déjà qu'il s'agit du titre en cours (la file), ou là
 * où l'on ne connaît qu'un contexte de lecture (la carte d'un album, d'une
 * playlist). Une seule tranche de l'instantané par houle : rien ne se
 * redessine tant que l'état affiché ne change pas.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { usePlayerSelector } from "../player/OctavePlayerProvider";
import { OceanSwell } from "./OceanSwell";

/** La houle du titre en cours (à monter sur sa seule rangée), qui suit lecture et pause. */
export const NowSwell = memo(function NowSwell({ className }: { className?: string }) {
  const playing = usePlayerSelector((s) => s.wantsPlay);
  return <OceanSwell playing={playing} className={className} />;
});

/**
 * La pastille d'une carte dont l'album ou la playlist se joue (`contextId` :
 * celui que lance la carte ou la vue, `album:<cible>`, `playlist:<id>`).
 * Rien tant que ce n'est pas ce contexte.
 */
export const CollectionSwell = memo(function CollectionSwell({ contextId }: { contextId: string | null }) {
  const { t } = useTranslation("music");
  const state = usePlayerSelector((s) => (contextId !== null && s.current !== null && s.queue.contextId === contextId ? (s.wantsPlay ? "play" : "pause") : null));
  if (state === null) return null;
  return (
    <span className="oc-collection-swell octave-night" title={t("track.nowPlaying")}>
      <OceanSwell playing={state === "play"} className="h-4 w-4" />
      <span className="sr-only">{t("track.nowPlaying")}</span>
    </span>
  );
});
