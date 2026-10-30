/**
 * Octave — la POIGNÉE d'une rangée réordonnable : la seule prise du glisser
 * (la rangée garde son clic qui lit, et son glisser vers une playlist du rail).
 * Révélée au survol, toujours visible sans survol possible (écran tactile).
 * Indisponible (recherche, filtre, chargement), elle le dit en mots au survol.
 */

import { memo, type MouseEvent, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface HandleSlot {
  /** Le rang de la rangée dans la liste affichée (ce que tient le geste). */
  index: number;
  title: string;
  /** Pourquoi le glisser n'est pas possible maintenant (`null` : il l'est). */
  blocked: string | null;
  lifted: boolean;
  props: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void;
    onClick: (e: MouseEvent<HTMLElement>) => void;
  };
}

const REVEAL = "octave-hover-reveal opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";

export const DragHandle = memo(function DragHandle({ slot }: { slot: HandleSlot }) {
  const { t } = useTranslation("music");
  const label = t("listOrder.handle", { title: slot.title });
  if (slot.blocked) {
    return (
      <div role="gridcell" className="flex h-8 w-5 items-center justify-center">
        <span title={slot.blocked} aria-label={`${label} — ${slot.blocked}`} role="img" className={`text-content-quaternary ${REVEAL}`}>
          <GripVertical className="h-4 w-4 opacity-50" aria-hidden />
        </span>
      </div>
    );
  }
  return (
    <div role="gridcell" className="flex h-8 w-5 items-center justify-center">
      <button
        type="button"
        aria-label={label}
        title={label}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        {...slot.props}
        // `touch-action: none` : au doigt, la poignée tire le titre au lieu de faire défiler la page.
        style={{ touchAction: "none" }}
        className={`flex h-10 w-5 cursor-grab items-center justify-center rounded text-content-tertiary transition-opacity duration-150 hover:text-content-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:cursor-grabbing ${slot.lifted ? "opacity-100 text-content-primary" : REVEAL}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
});
