/**
 * Octave — ouvrir le menu d'un album, d'un artiste ou d'une playlist : le bouton « … » (révélé au survol de la
 * carte, toujours là sans survol possible), le clic droit et l'appui long au point du pointeur. Le menu n'est
 * MONTÉ qu'ouvert : une grille de cent cartes ne tient aucun menu, aucune requête de plus.
 */

import { useCallback, useRef, useState, type MouseEvent, type ReactElement, type RefObject } from "react";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMusicShelvesCapability, usePlaylistSharingRules, type MusicShelfSubject } from "@tentacle-tv/api-client";
import { CollectionMenuPanel, subjectName } from "./CollectionMenu";
import { useLongPress } from "./useLongPress";

/** Le menu a-t-il quelque chose à offrir ? (le favori dès que le serveur le garde ; sinon la gestion d'une playlist) */
export function useCollectionMenuShown(subject: MusicShelfSubject): boolean {
  const capable = useMusicShelvesCapability();
  const playlist = subject.section === "playlists" && subject.item.kind === "library" ? subject.item.playlist : null;
  const { isMember } = usePlaylistSharingRules(playlist);
  return capable || playlist?.editable === true || isMember;
}

export type CollectionMenuHandlers = Partial<ReturnType<typeof useLongPress> & { onContextMenu: (e: MouseEvent) => void }>;

/** Le clic droit et l'appui long d'une carte ; `menu` à rendre à côté d'elle. Rien si le menu n'a rien à offrir. */
export function useCollectionContextMenu(subject: MusicShelfSubject): { handlers: CollectionMenuHandlers; menu: ReactElement | null } {
  const { t } = useTranslation("musicFavorites");
  const shown = useCollectionMenuShown(subject);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const press = useLongPress(setPoint);
  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setPoint({ x: e.clientX, y: e.clientY });
  }, []);
  return {
    handlers: shown ? { onContextMenu, ...press } : {},
    menu: point ? <CollectionMenuPanel subject={subject} anchor={point} ariaLabel={t("more", { name: subjectName(subject) })} onClose={() => setPoint(null)} /> : null,
  };
}

interface ButtonProps {
  subject: MusicShelfSubject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  /** Le nom du bouton (par défaut « Plus d'actions pour « … » »). */
  label?: string;
}

export function CollectionMenuButton({ subject, open, onOpenChange, className = "h-11 w-11", label }: ButtonProps) {
  const { t } = useTranslation("musicFavorites");
  const anchor = useRef<HTMLButtonElement>(null);
  const shown = useCollectionMenuShown(subject);
  if (!shown) return null;
  const name = label ?? t("more", { name: subjectName(subject) });
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        title={name}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenChange(!open);
        }}
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open && <CollectionMenuPanel subject={subject} anchor={anchor as RefObject<HTMLButtonElement | null>} ariaLabel={name} onClose={() => onOpenChange(false)} />}
    </>
  );
}
