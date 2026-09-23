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
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone, Pin, Settings2 } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { easeOut } from "../../theme/motion";
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
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-fill-subtle focus-visible:ring-2 focus-visible:ring-line-focus";

// Trois bibliothèques tiennent sur une ligne ; deux ou quatre, sur deux
// colonnes — jamais une tuile orpheline sous une ligne pleine quand on l'évite.
function libraryColumns(count: number): string {
  if (count <= 1) return "grid-cols-1";
  return count === 2 || count === 4 ? "grid-cols-2" : "grid-cols-3";
}

function SectionTitle({ children }: { children: string }) {
  return <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{children}</p>;
}

const LibraryTile = memo(function LibraryTile({ library, active, onClose, onTogglePin }: {
  library: NavLibrary;
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
        className={`group relative flex h-[76px] items-end gap-2 overflow-hidden rounded-xl border p-3 outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          active ? "border-[var(--nav-active-ring)]" : "border-line-subtle"
        }`}
        style={art === null ? { background: "linear-gradient(135deg, rgba(var(--brand-rgb), 0.35), var(--fill-soft))" } : undefined}
      >
        {art !== null && (
          <img src={art} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5" />
        <Icon aria-hidden className="relative h-4 w-4 shrink-0 text-[var(--on-media-primary)]" strokeWidth={2} />
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
          className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-[var(--on-media-primary)] outline-none transition-opacity hover:bg-black/75 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-line-focus ${
            library.pinned ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100"
          }`}
        >
          <Pin aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} fill={library.pinned ? "currentColor" : "none"} />
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
    <div className="flex items-center gap-1">
      <Link
        to={entry.path}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-line-focus ${
          active ? "bg-fill-soft font-semibold text-content-primary" : "text-content-secondary hover:bg-fill-subtle hover:text-content-primary"
        }`}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0 text-content-tertiary" strokeWidth={1.9} />
        <span className="truncate">{entry.label}</span>
      </Link>
      <button
        type="button"
        onClick={() => onTogglePin(entry)}
        aria-pressed={entry.pinned}
        aria-label={`${label} — ${entry.label}`}
        title={label}
        className={`${PIN_BUTTON} ${entry.pinned ? "text-[var(--brand-light)]" : "text-content-quaternary hover:text-content-secondary"}`}
      >
        <Pin aria-hidden className="h-4 w-4" strokeWidth={2} fill={entry.pinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
});

export function NavMorePanel({ libraries, lists, extensions, editor, trigger, onClose, onCustomize }: NavMorePanelProps) {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const togglePin = useCallback(
    (entry: { key: string; pinned: boolean }) => (entry.pinned ? editor.unpin(entry.key) : editor.pin(entry.key)),
    [editor],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onClose();
      trigger.current?.focus();
    };
    // Un clic sur le bouton lui-même est laissé à son propre basculement.
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || trigger.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose, trigger]);

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label={t("more")}
      className="absolute left-0 top-[calc(100%+14px)] z-50 w-[min(620px,calc(100vw-32px))] rounded-2xl border border-line-subtle bg-[color:var(--nav-panel-bg)] p-4 shadow-[var(--shadow-dropdown)]"
      initial={reduced ? false : { opacity: 0, y: -6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: easeOut }}
    >
      {libraries.length > 0 && (
        <section>
          <SectionTitle>{t("libraries")}</SectionTitle>
          <div className={`grid gap-2 ${libraryColumns(libraries.length)}`}>
            {libraries.map((library) => (
              <LibraryTile key={library.key} library={library} active={isActivePath(library.path, pathname)} onClose={onClose} onTogglePin={togglePin} />
            ))}
          </div>
        </section>
      )}
      <div className={`grid gap-4 ${extensions.length > 0 ? "grid-cols-2" : "grid-cols-1"} ${libraries.length > 0 ? "mt-4 border-t border-line-subtle pt-4" : ""}`}>
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
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-3">
        <Link
          to="/pair-device"
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-content-secondary outline-none transition-colors hover:bg-fill-subtle hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <MonitorSmartphone aria-hidden className="h-4 w-4 text-content-tertiary" strokeWidth={1.9} />
          {t("pairDevice")}
        </Link>
        <button
          type="button"
          onClick={onCustomize}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line-subtle bg-fill-soft px-3.5 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:bg-fill-medium focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <Settings2 aria-hidden className="h-4 w-4 text-[var(--brand-light)]" strokeWidth={2} />
          {t("customizeBar")}
        </button>
      </div>
    </motion.div>
  );
}
