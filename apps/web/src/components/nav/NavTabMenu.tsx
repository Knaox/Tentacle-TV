/**
 * Le menu d'un clic droit sur la barre : retirer l'onglet visé, ou ouvrir
 * « Personnaliser la barre ». Le geste le plus court pour désépingler — une
 * bibliothèque dont on ne veut pas dans la barre en sort en deux clics.
 *
 * La touche Menu du clavier (ou Maj+F10) déclenche le même évènement sur
 * l'onglet qui a le focus : le menu est donc aussi atteignable sans souris.
 * ↑ ↓ passent d'une entrée à l'autre, Échap le ferme.
 *
 * Rendu dans `<body>` : sous la capsule, un `position: fixed` serait piégé par
 * le bloc conteneur de la barre.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { PushPinSlashIcon as PinOff } from "@phosphor-icons/react/dist/csr/PushPinSlash";
import { SlidersHorizontalIcon as Settings2 } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { useGlassControl } from "../ui/glass/useGlassControl";
import { lastInputWasKeyboard } from "../../lib/inputModality";

const ITEM =
  "ui-menu-item";

export interface NavTabMenuTarget {
  x: number;
  y: number;
  /** L'onglet visé — `null` : le bouton « Plus », rien à retirer. */
  key: string | null;
  label: string | null;
}

export function NavTabMenu({ target, onUnpin, onCustomize, onClose }: {
  target: NavTabMenuTarget;
  onUnpin: (key: string) => void;
  onCustomize: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nav");
  const ref = useRef<HTMLDivElement>(null);
  // Le geste qui l'a ouvert, lu une fois au montage : clic droit, ou touche Menu.
  const [byKeyboard] = useState(lastInputWasKeyboard);
  // Verre natif : la lentille et le ton du dessous, comme les menus du calque commun.
  const glass = useGlassControl<HTMLDivElement>({ lens: "regular", scale: "surface" });
  const { ref: glassRef } = glass;
  const setPanel = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    glassRef(node);
  }, [glassRef]);
  const [position, setPosition] = useState({ left: target.x, top: target.y });

  // Le menu reste dans la fenêtre, même ouvert au bord droit.
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      left: Math.max(8, Math.min(target.x, window.innerWidth - box.width - 8)),
      top: Math.max(8, Math.min(target.y, window.innerHeight - box.height - 8)),
    });
  }, [target.x, target.y]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const dismiss = () => onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  return createPortal(
    <div
      ref={setPanel}
      {...glass.props}
      role="menu"
      aria-label={t("customizeBar")}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ...position, ...glass.props.style }}
      // Il sort du pointeur (son coin haut-gauche) ; ouvert à la touche Menu, il est là d'emblée.
      className={`lg-menu lg-menu-list ui-menu fixed z-[60] min-w-56 ${byKeyboard ? "" : "origin-top-left animate-scale-in"}`}
    >
      {glass.layers}
      {target.key !== null && (
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={() => {
            onUnpin(target.key as string);
            onClose();
          }}
        >
          <PinOff aria-hidden className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("unpinNamed", { name: target.label })}</span>
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        onClick={() => {
          onClose();
          onCustomize();
        }}
      >
        <Settings2 aria-hidden className="h-4 w-4 shrink-0" />
        {t("customizeBarEllipsis")}
      </button>
    </div>,
    document.body,
  );
}
