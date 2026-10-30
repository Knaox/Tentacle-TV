/**
 * Octave — la glissière commune (progression, volume) : un rail fin, un
 * remplissage en ÉCHELLE (dégradé pour la progression, rose plein pour le
 * volume), une tête qui paraît au survol, à la saisie et au focus. Un
 * `<input type="range">` invisible, AU-DESSUS, porte le clavier et les
 * lecteurs d'écran ; la zone de saisie fait 24 px de haut.
 *
 * Avec `onScrub`, le POINTEUR est lu ici (`pointerScrub.ts`) : la valeur est
 * celle du point cliqué sur le rail dessiné, au pixel près — jamais la règle du
 * curseur natif, décalée d'une demi-largeur de curseur. `onScrubEnd` reçoit la
 * valeur du lâcher.
 *
 * Rien ne s'anime en continu : le remplissage et la tête sont posés à chaque
 * nouvelle valeur (`shell.css`).
 */

import { memo, useRef, type CSSProperties, type InputHTMLAttributes, type PointerEvent } from "react";
import { pointerValue } from "./pointerScrub";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "style">;

interface RangeSliderProps extends InputProps {
  /** Ce qui est montré, de 0 à 1. */
  ratio: number;
  fill: "progress" | "volume";
  dragging?: boolean;
  className?: string;
  /** La valeur sous le pointeur, pendant l'appui et le glissé. */
  onScrub?: (value: number) => void;
  /** Le lâcher, avec sa valeur (ou `null` si le geste est annulé). */
  onScrubEnd?: (value: number | null) => void;
}

export const RangeSlider = memo(function RangeSlider({ ratio, fill, dragging = false, className = "", disabled, onScrub, onScrubEnd, ...input }: RangeSliderProps) {
  const at = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const rail = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const valueAt = (clientX: number): number | null => {
    const box = rail.current?.getBoundingClientRect();
    if (!box) return null;
    return pointerValue(clientX, box, Number(input.min ?? 0), Number(input.max ?? 100));
  };

  const pointer = onScrub
    ? {
        onPointerDown: (e: PointerEvent<HTMLInputElement>) => {
          if (disabled || e.button !== 0) return;
          const value = valueAt(e.clientX);
          if (value === null) return;
          // Le curseur natif ne bouge pas : la valeur est la nôtre. Le focus reste donné (clavier ensuite).
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.setPointerCapture(e.pointerId);
          scrubbing.current = true;
          onScrub(value);
        },
        onPointerMove: (e: PointerEvent<HTMLInputElement>) => {
          if (!scrubbing.current) return;
          const value = valueAt(e.clientX);
          if (value !== null) onScrub(value);
        },
        onPointerUp: (e: PointerEvent<HTMLInputElement>) => {
          if (!scrubbing.current) return;
          scrubbing.current = false;
          onScrubEnd?.(valueAt(e.clientX));
        },
        onPointerCancel: () => {
          if (!scrubbing.current) return;
          scrubbing.current = false;
          onScrubEnd?.(null);
        },
      }
    : {};

  return (
    <div className={`octave-range ${className}`} data-dragging={dragging ? "true" : "false"} data-disabled={disabled ? "true" : "false"}>
      <input
        type="range"
        disabled={disabled}
        {...input}
        {...pointer}
        className="octave-range-input absolute inset-0 z-[1] m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
      <div ref={rail} className="octave-range-rail">
        <div className="octave-range-fill" data-fill={fill} style={{ transform: `scaleX(${at})` }} />
      </div>
      <div className="octave-range-head" style={{ "--oc-at": at } as CSSProperties}>
        <span className="octave-range-dot" />
      </div>
    </div>
  );
});
