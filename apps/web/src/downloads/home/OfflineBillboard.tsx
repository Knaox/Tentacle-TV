/**
 * La bannière de l'accueil hors ligne — celle de l'accueil en ligne
 * (`HeroBillboard`), au pixel près : même cadre, même hauteur, mêmes voiles,
 * même zoom et même fondu enchaîné, même halo, mêmes indicateurs. Seule la
 * source change : les titres de la machine (reprises d'abord, puis les
 * derniers arrivés, une diapositive par série) et leurs visuels posés sur le
 * disque. Elle ne coûte pas un octet de réseau.
 *
 * Mêmes gardes GPU que l'original, pour les mêmes raisons mesurées : rotation,
 * zoom et halo ne tournent QUE bannière à l'écran, fenêtre au premier plan et
 * quelqu'un devant ; le halo est démonté hors champ. Mêmes flèches toujours
 * présentes et mêmes gestes (← →, molette horizontale, glissé) que l'original.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { AmbilightLayer } from "../../components/hero/AmbilightLayer";
import { CARD_HEIGHT, FRAME_GUTTER } from "../../components/hero/HeroBillboard";
import { HERO_ZOOM_DURATION_S, HeroBackdropLayer } from "../../components/hero/HeroBackdrop";
import { HeroIndicators } from "../../components/hero/HeroIndicators";
import { useBillboardGestures } from "../../components/hero/useBillboardGestures";
import { useBillboardRotation } from "../../components/hero/useBillboardRotation";
import { BackButton } from "../../components/ui/BackButton";
import { useIdle } from "../../hooks/useIdle";
import { useBillboardViewport } from "../../components/hero/useBillboardViewport";
import { billboardActivity } from "../../components/hero/billboardActivity";
import { localResourceUrl } from "../localFiles";
import { OfflineBillboardContent } from "./OfflineBillboardContent";

/** Même silence que la bannière en ligne avant de cesser de se relancer. */
const IDLE_MS = 20_000;
const ROTATE_MS = HERO_ZOOM_DURATION_S * 1000;

interface Props {
  entries: readonly DownloadListEntry[];
  /** « Sur cet appareil » ouvert EN LIGNE n'est pas une racine : le Retour, posé sur l'image. */
  back?: boolean;
}

export function OfflineBillboard({ entries, back = false }: Props) {
  const { t } = useTranslation("downloads");
  // Halo monté à 200 px, rotation strictement à l'écran (`billboardActivity`).
  const { ref: frameRef, near, onScreen } = useBillboardViewport<HTMLDivElement>();
  const idle = useIdle(IDLE_MS);
  const activity = billboardActivity({ near, onScreen, idle, dataSaver: false });
  const { index, animKey, selectWithGrace, prevWithGrace, nextWithGrace } = useBillboardRotation({
    count: entries.length,
    rotateMs: ROTATE_MS,
    active: activity.rotating,
  });
  const gestures = useBillboardGestures({ onPrev: prevWithGrace, onNext: nextWithGrace });
  // Chaque pastille porte le nom de son titre (la série, pour un épisode).
  const labels = useMemo(() => entries.map((e) => (e.kind === "episode" ? e.seriesName : null) ?? e.title ?? ""), [entries]);

  const entry = entries[index] ?? entries[0];
  if (entry === undefined) return null;
  const backdrop = localResourceUrl(`meta/${entry.itemId}/backdrop.jpg`);

  return (
    <section className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`} aria-label={t("heroLabel")}>
      <div ref={frameRef} className="relative">
        {activity.haloMounted && <AmbilightLayer url={backdrop} layerKey={entry.itemId} />}
        <div
          role="group"
          aria-roledescription="carousel"
          aria-label={t("heroLabel")}
          tabIndex={0}
          className={`group/billboard relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{ borderRadius: "var(--hero-frame-radius)", boxShadow: "var(--hero-frame-ring)", touchAction: "pan-y" }}
          {...gestures}
        >
          <HeroBackdropLayer imageKey={entry.itemId} url={backdrop} />
          {back && <BackButton onMedia className="absolute left-4 top-4 z-20 md:left-6 md:top-6" />}
          <OfflineBillboardContent entry={entry} animationKey={animKey} />
          <HeroIndicators
            count={entries.length}
            activeIndex={index}
            durationMs={ROTATE_MS}
            labels={labels}
            onSelect={selectWithGrace}
            onPrev={prevWithGrace}
            onNext={nextWithGrace}
          />
        </div>
      </div>
    </section>
  );
}
