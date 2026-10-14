import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

/**
 * Le clavier dans le menu de l'avatar : à l'ouverture le focus entre sur la
 * première entrée (« Changer de profil » en tête, s'il est là), les
 * flèches Haut et Bas passent d'une entrée à l'autre en bouclant, Début et Fin
 * vont aux extrémités ; Échap ferme (`Dropdown`). Le menu reste aussi
 * parcourable à la tabulation.
 */
export function useMenuKeyboard(open: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Après l'apparition du panneau (animation d'entrée) : sinon rien n'est encore focalisable.
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home" ? 0
        : event.key === "End" ? items.length - 1
          : event.key === "ArrowDown" ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }, []);

  return { panelRef, onKeyDown };
}
