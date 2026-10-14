import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import type { AvatarGalleryMode } from "./AvatarGalleryDialog";

// La galerie (et sa feuille de style) ne se charge qu'à la première ouverture.
const AvatarGalleryDialog = lazy(() => import("./AvatarGalleryDialog"));

export interface AvatarGallery {
  openGallery: () => void;
  isOpen: boolean;
  /** À rendre là où l'on ouvre la galerie : rien tant qu'elle n'a jamais été ouverte. */
  dialog: ReactNode;
}

/**
 * Ouvrir la galerie des photos de profil depuis n'importe quel bouton « changer
 * la photo » — le menu de l'avatar, la page Profil, celle de la fenêtre étroite.
 * Le composant reste monté après la première ouverture : la fermeture garde
 * son animation de sortie.
 */
export function useAvatarGallery(mode: AvatarGalleryMode = "change", onClosed?: () => void): AvatarGallery {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const openGallery = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    onClosed?.();
  }, [onClosed]);

  const dialog = mounted ? (
    <Suspense fallback={null}>
      <AvatarGalleryDialog open={open} mode={mode} onClose={close} />
    </Suspense>
  ) : null;

  return { openGallery, isOpen: open, dialog };
}
