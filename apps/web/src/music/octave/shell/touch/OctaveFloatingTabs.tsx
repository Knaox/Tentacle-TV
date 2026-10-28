/**
 * Octave — la barre d'onglets du téléphone : une pilule de verre SOMBRE (la
 * nuit d'Octave) qui flotte au-dessus de la page, les cinq destinations du rail
 * du bureau, l'active marquée par une pastille qui GLISSE (la grammaire de la
 * barre du miroir et de l'app mobile : mêmes mesures, `mirror/shell/metrics`).
 *
 * Hors des cinq destinations (album, artiste, playlist…), aucune pastille : la
 * page est « dans » la pile, pas un onglet.
 */

import { memo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLiquidGlassSurface } from "../../../../theme/glass";
import { useSlidingIndicator } from "../../../../mirror/shell/useSlidingIndicator";
import { TAB_PILL_H, TAB_PILL_W, TAB_ROW_PAD_V } from "../../../../mirror/shell/metrics";
import { OCTAVE_DESTINATIONS } from "../OctaveSidebar";
import { activeDestinationIndex } from "./activeDestination";

export const OctaveFloatingTabs = memo(function OctaveFloatingTabs() {
  const { t } = useTranslation("music");
  const { pathname } = useLocation();
  const active = activeDestinationIndex(pathname, OCTAVE_DESTINATIONS);
  const indicator = useSlidingIndicator(active, { size: { width: TAB_PILL_W, height: TAB_PILL_H }, align: "top" });
  const glass = useLiquidGlassSurface({
    material: "pane",
    tone: "dark",
    shape: "rounded",
    className: "octave-night octave-float-tabs pointer-events-auto",
    fallbackClassName: "octave-dock-fallback",
  });
  return (
    <nav aria-label={t("nav.main")} data-octave-tabs {...glass.props}>
      {glass.layers}
      <div ref={indicator.trackRef} className="relative flex items-center" style={{ padding: `${TAB_ROW_PAD_V}px 6px` }}>
        <span aria-hidden className="octave-float-tabs-pill pointer-events-none absolute left-0 top-0 rounded-full" style={indicator.style} />
        {/* L'écart icône-libellé, 2 px : `gap-0.5` (= TAB_LABEL_GAP du miroir). */}
        {OCTAVE_DESTINATIONS.map(({ to, key, Icon, end }, i) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-tab-item
            className="octave-touch relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <span className="flex items-center justify-center" style={{ width: TAB_PILL_W, height: TAB_PILL_H }}>
              <Icon className={`h-[22px] w-[22px] ${i === active ? "text-octave-accent-text" : "text-content-tertiary"}`} strokeWidth={i === active ? 2.2 : 1.8} aria-hidden />
            </span>
            <span className={`max-w-full truncate text-[11px] font-semibold leading-[13px] ${i === active ? "text-content-primary" : "text-content-tertiary"}`}>
              {t(key)}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
});
