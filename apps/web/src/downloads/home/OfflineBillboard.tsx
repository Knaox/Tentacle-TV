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
 * quelqu'un devant ; le halo est démonté hors champ, les flèches montées au
 * survol seulement.
 */

import { useTranslation } from "react-i18next";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { AmbilightLayer } from "../../components/hero/AmbilightLayer";
import { CARD_HEIGHT, FRAME_GUTTER } from "../../components/hero/HeroBillboard";
import { HERO_ZOOM_DURATION_S, HeroBackdropLayer } from "../../components/hero/HeroBackdrop";
import { HeroIndicators } from "../../components/hero/HeroIndicators";
import { useBillboardRotation } from "../../components/hero/useBillboardRotation";
import { useHoverMount } from "../../hooks/useHoverMount";
import { useIdle } from "../../hooks/useIdle";
import { useInViewport } from "../../hooks/useInViewport";
import { localResourceUrl } from "../localFiles";
import { OfflineBillboardContent } from "./OfflineBillboardContent";

/** Même silence que la bannière en ligne avant de cesser de se relancer. */
const IDLE_MS = 20_000;
const ROTATE_MS = HERO_ZOOM_DURATION_S * 1000;

export function OfflineBillboard({ entries }: { entries: readonly DownloadListEntry[] }) {
  const { t } = useTranslation("downloads");
  const { ref: frameRef, visible } = useInViewport<HTMLDivElement>("200px");
  const idle = useIdle(IDLE_MS);
  const arrows = useHoverMount(300);
  const { index, animKey, selectWithGrace, prevWithGrace, nextWithGrace } = useBillboardRotation({
    count: entries.length,
    rotateMs: ROTATE_MS,
    active: visible && !idle,
  });

  const entry = entries[index] ?? entries[0];
  if (entry === undefined) return null;
  const backdrop = localResourceUrl(`meta/${entry.itemId}/backdrop.jpg`);

  return (
    <section className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`} aria-label={t("heroLabel")}>
      <div ref={frameRef} className="relative">
        {visible && <AmbilightLayer url={backdrop} layerKey={entry.itemId} />}
        <div
          className={`group/billboard relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{ borderRadius: "var(--hero-frame-radius)", boxShadow: "var(--hero-frame-ring)" }}
          onMouseEnter={arrows.onMouseEnter}
          onMouseLeave={arrows.onMouseLeave}
        >
          <HeroBackdropLayer imageKey={entry.itemId} url={backdrop} />
          <OfflineBillboardContent entry={entry} animationKey={animKey} />
          <HeroIndicators
            count={entries.length}
            activeIndex={index}
            durationMs={ROTATE_MS}
            arrowsMounted={arrows.mounted}
            arrowsShown={arrows.hovered}
            onSelect={selectWithGrace}
            onPrev={prevWithGrace}
            onNext={nextWithGrace}
          />
        </div>
      </div>
    </section>
  );
}
