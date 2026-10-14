import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import type { AvatarGalleryMode } from "./AvatarGalleryDialog";
import { ACCOUNT_TARGET, type AvatarTarget } from "./useAvatarTarget";

// La galerie (et sa feuille de style) ne se charge qu'à la première ouverture.
const AvatarGalleryDialog = lazy(() => import("./AvatarGalleryDialog"));

export interface AvatarGallery {
  /** Ouvre la galerie pour le compte (défaut) ou pour un invité de la Famille. */
  openGallery: (target?: AvatarTarget) => void;
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
  const [target, setTarget] = useState<AvatarTarget>(ACCOUNT_TARGET);

  const openGallery = useCallback((next: AvatarTarget = ACCOUNT_TARGET) => {
    setTarget(next);
    setMounted(true);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    onClosed?.();
  }, [onClosed]);

  const dialog = mounted ? (
    <Suspense fallback={null}>
      <AvatarGalleryDialog open={open} mode={mode} target={target} onClose={close} />
    </Suspense>
  ) : null;

  return { openGallery, isOpen: open, dialog };
}
