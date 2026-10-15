import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCardFace, useCardToggles } from "@tentacle-tv/api-client";
import { cardActionEntries, resolveCardOverlay, type CardToggleKind, type MediaItem } from "@tentacle-tv/shared";
import { ToggleGlyph } from "./cards/CardActionTray";
import { FloatingLayer } from "./floating/FloatingLayer";

interface Props {
  item: MediaItem;
  x: number;
  y: number;
  onClose: () => void;
}

/**
 * Le menu du clic droit sur une carte — un second chemin vers les bascules du
 * survol, dans le MÊME ordre (Ma liste, favori, vu), avec les mêmes glyphes
 * et les mêmes libellés (`cardActionEntries`). Il avait sa propre copie de la
 * logique, un cœur rouge, et pas de « vu ».
 *
 * La lecture et la note restent au survol : le menu n'est qu'un raccourci.
 */
export function MediaContextMenu({ item, x, y, onClose }: Props) {
  const { t } = useTranslation("common");
  // Le point du clic : la règle commune y pose le menu, retourné ou décalé
  // près d'un bord (il mesurait une hauteur supposée de 200 px).
  const anchor = useMemo(() => ({ x, y }), [x, y]);

  // Un défilement emporte la carte : le menu se ferme (Échap et clic dehors : le calque).
  useEffect(() => {
    window.addEventListener("scroll", onClose, true);
    return () => window.removeEventListener("scroll", onClose, true);
  }, [onClose]);

  return (
    <FloatingLayer
      open
      anchor={anchor}
      onDismiss={onClose}
      side="bottom"
      align="start"
      gap={2}
      role="menu"
      ariaLabel={t("common:moreInfo")}
      className="min-w-[240px] overflow-y-auto overscroll-contain rounded-xl border border-line-subtle bg-surface-dropdown py-1 shadow-2xl backdrop-blur-lg"
    >
      <MenuToggles item={item} onDone={onClose} />
    </FloatingLayer>
  );
}

/** Les bascules du modèle, pour le visage complet de la carte (résumé de recherche compris). */
function MenuToggles({ item, onDone }: { item: MediaItem; onDone: () => void }) {
  const { t } = useTranslation("cards");
  const { face } = useCardFace(item, { enabled: true });
  const toggles = useCardToggles(face ?? item);
  const overlay = resolveCardOverlay({ variant: "poster", inLibrary: true, playable: false, rateable: false });
  const entries = cardActionEntries(overlay, toggles.states);

  return (
    <>
      {entries.map((entry) => {
        const kind = entry.kind as CardToggleKind;
        const active = entry.active === true;
        return (
          <button
            key={entry.kind}
            role="menuitem"
            type="button"
            onClick={() => {
              toggles.toggle(kind);
              onDone();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-content-secondary transition-colors hover:bg-fill-soft"
          >
            <span className={active ? (kind === "favorite" ? "text-[var(--brand-accent)]" : "text-[var(--brand-light)]") : "text-content-tertiary"}>
              <ToggleGlyph kind={kind} className="h-4 w-4" filled={active} />
            </span>
            {t(entry.labelKey)}
          </button>
        );
      })}
    </>
  );
}
