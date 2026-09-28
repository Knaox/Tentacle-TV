import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useCardFace, useCardToggles } from "@tentacle-tv/api-client";
import { cardActionEntries, resolveCardOverlay, type CardToggleKind, type MediaItem } from "@tentacle-tv/shared";
import { ToggleGlyph } from "./cards/CardActionTray";

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
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [handleClickOutside, onClose]);

  // Clamp position to viewport
  const clampedX = Math.min(x, window.innerWidth - 260);
  const clampedY = Math.min(y, window.innerHeight - 200);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("common:moreInfo")}
      className="fixed z-50 min-w-[240px] overflow-hidden rounded-xl border border-line-subtle bg-surface-dropdown py-1 shadow-2xl backdrop-blur-lg"
      style={{
        left: clampedX,
        top: clampedY,
        animation: "ctxMenuIn 150ms ease forwards",
      }}
    >
      <style>{`
        @keyframes ctxMenuIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <MenuToggles item={item} onDone={onClose} />
    </div>,
    document.body
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
