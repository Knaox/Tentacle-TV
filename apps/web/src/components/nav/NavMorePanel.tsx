/**
 * « Plus » — tout ce que la barre ne montre pas, d'un seul panneau :
 *
 * - les BIBLIOTHÈQUES en tuiles illustrées par une de leurs œuvres (le fond
 *   d'un film pris au hasard, déjà relevé par `useLibraries`), avec leur
 *   nombre de titres — et leur épingle : une bibliothèque se retire de la
 *   barre, ou y revient, d'ici ;
 * - « Mes listes » et les pages d'EXTENSIONS, chacune ÉPINGLABLE dans la barre
 *   d'un clic sur l'épingle ;
 * - le jumelage d'une TV, et « Personnaliser la barre ».
 *
 * Épingler range la destination au bout de la barre (`editor.pin`).
 *
 * Fond OPAQUE (`--nav-panel-bg`), donc aucun `backdrop-filter` : il n'y
 * aurait rien à flouter (CLAUDE.md, « Coût GPU »). Échap et un clic dehors le
 * ferment ; le focus revient au bouton qui l'a ouvert.
 */

import { memo, useCallback, useEffect, useRef, type RefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DevicesIcon as MonitorSmartphone } from "@phosphor-icons/react/dist/csr/Devices";
import { PushPinIcon as Pin } from "@phosphor-icons/react/dist/csr/PushPin";
import { SlidersHorizontalIcon as Settings2 } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { FloatingLayer } from "../floating/FloatingLayer";
import { ON_MEDIA_ACCENT_TEXT, ON_MEDIA_PILL } from "../cards/onMedia";
import { isActivePath, type NavBarEditor, type NavLibrary, type NavListEntry } from "./useNavDestinations";

interface NavMorePanelProps {
  libraries: readonly NavLibrary[];
  lists: readonly NavListEntry[];
  extensions: readonly NavListEntry[];
  editor: NavBarEditor;
  trigger: RefObject<HTMLElement | null>;
  onClose: () => void;
  onCustomize: () => void;
}

const PIN_BUTTON =
  "icon-btn btn-sm";

// Trois bibliothèques tiennent sur une ligne ; deux ou quatre, sur deux
// colonnes — jamais une tuile orpheline sous une ligne pleine quand on l'évite.
function libraryColumns(count: number): string {
  if (count <= 1) return "grid-cols-1";
  return count === 2 || count === 4 ? "grid-cols-2" : "grid-cols-3";
}

/** Au-delà de trois lignes de tuiles, elles se resserrent : vingt bibliothèques tiennent sans défiler à 900 px. */
const COMPACT_ABOVE = 9;

function SectionTitle({ children }: { children: string }) {
  return <p className="lg-menu-label ui-eyebrow mb-2 px-1">{children}</p>;
}

const LibraryTile = memo(function LibraryTile({ library, active, compact, onClose, onTogglePin }: {
  library: NavLibrary;
  /** Beaucoup de bibliothèques : des tuiles plus basses, pour que le panneau tienne à l'écran. */
  compact: boolean;
  active: boolean;
  onClose: () => void;
  onTogglePin: (library: NavLibrary) => void;
}) {
  const { t } = useTranslation("nav");
  const client = useJellyfinClient();
  const Icon = library.icon;
  const art = library.artworkId ? client.getImageUrl(library.artworkId, "Backdrop", { width: 480, quality: 70 }) : null;
  const pinLabel = library.pinned ? t("unpinFromBar") : t("pinToBar");
  return (
    // L'épingle est une SŒUR du lien, posée par-dessus : un bouton dans un
    // lien serait un élément interactif dans un autre.
    <div className="group/tile relative">
      <Link
        to={library.path}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        // La page courante : un trait à la teinte franche, DANS l'arrondi (un état actif, pas un contour).
        className={`lg-tile group relative flex ${compact ? "h-[56px]" : "h-[76px]"} items-end gap-2 overflow-hidden rounded-card bg-surface-3 p-3 outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          active ? "shadow-[inset_0_0_0_2px_var(--accent)]" : ""
        }`}
      >
        {art !== null && (
          <img src={art} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        {/* Le voile qui porte le libellé ; au survol il s'éclaircit — l'image, elle, ne bouge pas. */}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[rgba(11,11,12,0.88)] via-[rgba(11,11,12,0.45)] to-[rgba(11,11,12,0.05)] transition-opacity duration-hover group-hover:opacity-80" />
        <Icon aria-hidden className="relative h-4 w-4 shrink-0 text-[var(--on-media-primary)]" />
        <span className="relative min-w-0 flex-1 truncate text-sm font-semibold text-[var(--on-media-primary)]">{library.label}</span>
        {library.count > 0 && (
          <span className="relative shrink-0 text-[11px] tabular-nums text-[var(--on-media-secondary)]">
            {t("libraryTitles", { count: library.count })}
          </span>
        )}
      </Link>
      {library.watchable && (
        <button
          type="button"
          onClick={() => onTogglePin(library)}
          aria-pressed={library.pinned}
          aria-label={`${pinLabel} — ${library.label}`}
          title={pinLabel}
          // Épinglée : l'épingle se voit toujours. Sinon, au survol ou au focus.
          className={`lg-tile-pin absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-pill outline-none transition-[opacity,transform] duration-press ease-out active:scale-[var(--press-scale)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-line-focus ${ON_MEDIA_PILL} ${
            library.pinned ? `opacity-100 ${ON_MEDIA_ACCENT_TEXT}` : "text-on-media-primary opacity-0 group-hover/tile:opacity-100"
          }`}
        >
          <Pin weight={library.pinned ? "fill" : "regular"} aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

const PinnableRow = memo(function PinnableRow({ entry, active, onClose, onTogglePin }: {
  entry: NavListEntry;
  active: boolean;
  onClose: () => void;
  onTogglePin: (entry: NavListEntry) => void;
}) {
  const { t } = useTranslation("nav");
  const Icon = entry.icon;
  const label = entry.pinned ? t("unpinFromBar") : t("pinToBar");
  return (
    <div className="lg-row flex items-center gap-1">
      <Link
        to={entry.path}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`ui-menu-item min-w-0 flex-1 ${active ? "bg-fill-soft font-semibold" : ""}`}
      >
        <Icon aria-hidden weight={active ? "fill" : "regular"} className={`h-4 w-4 shrink-0 ${active ? "text-accent" : "text-content-tertiary"}`} />
        <span className="truncate">{entry.label}</span>
      </Link>
      {/* Une page que son extension cache de la barre s'ouvre d'ici, sans épingle. */}
      {entry.pinnable !== false && <button
        type="button"
        onClick={() => onTogglePin(entry)}
        aria-pressed={entry.pinned}
        aria-label={`${label} — ${entry.label}`}
        title={label}
        className={PIN_BUTTON}
      >
        <Pin weight={entry.pinned ? "fill" : "regular"} aria-hidden className="h-4 w-4" />
      </button>}
    </div>
  );
});

export function NavMorePanel({ libraries, lists, extensions, editor, trigger, onClose, onCustomize }: NavMorePanelProps) {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const togglePin = useCallback(
    (entry: { key: string; pinned: boolean }) => (entry.pinned ? editor.unpin(entry.key) : editor.pin(entry.key)),
    [editor],
  );

  // Échap rend le focus au bouton « Plus » (le calque ferme ; le clic sur le
  // bouton lui-même est laissé à son propre basculement).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") trigger.current?.focus(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trigger]);

  return (
    <FloatingLayer
      open
      anchor={trigger}
      onDismiss={onClose}
      side="bottom"
      align="start"
      gap={14}
      panelRef={panelRef}
      role="dialog"
      ariaLabel={t("more")}
      className="lg-menu lg-menu-wide lg-more w-[620px] overflow-y-auto overscroll-contain rounded-tile bg-surface-dropdown p-4 shadow-menu"
    >
      {libraries.length > 0 && (
        <section>
          <SectionTitle>{t("libraries")}</SectionTitle>
          <div className={`grid gap-2 ${libraryColumns(libraries.length)}`}>
            {libraries.map((library) => (
              <LibraryTile key={library.key} library={library} active={isActivePath(library.path, pathname)} compact={libraries.length > COMPACT_ABOVE} onClose={onClose} onTogglePin={togglePin} />
            ))}
          </div>
        </section>
      )}
      <div className={`grid gap-4 ${extensions.length > 0 ? "grid-cols-2" : "grid-cols-1"} ${libraries.length > 0 ? "lg-sep mt-4 border-t border-line-subtle pt-4" : ""}`}>
        <section>
          <SectionTitle>{t("lists")}</SectionTitle>
          {lists.map((entry) => <PinnableRow key={entry.key} entry={entry} active={isActivePath(entry.path, pathname)} onClose={onClose} onTogglePin={togglePin} />)}
        </section>
        {extensions.length > 0 && (
          <section>
            <SectionTitle>{t("extensions")}</SectionTitle>
            {extensions.map((entry) => <PinnableRow key={entry.key} entry={entry} active={isActivePath(entry.path, pathname)} onClose={onClose} onTogglePin={togglePin} />)}
          </section>
        )}
      </div>
      <div className="lg-sep mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-3">
        <Link
          to="/pair-device"
          onClick={onClose}
          className="lg-row ui-menu-item w-auto"
        >
          <MonitorSmartphone aria-hidden className="h-4 w-4 text-content-tertiary" />
          {t("pairDevice")}
        </Link>
        <button
          type="button"
          onClick={onCustomize}
          data-nav-customize
          className="lg-menu-button btn btn-sm btn-soft"
        >
          <Settings2 aria-hidden className="h-4 w-4" />
          {t("customizeBar")}
        </button>
      </div>
    </FloatingLayer>
  );
}
