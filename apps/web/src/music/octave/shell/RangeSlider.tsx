/**
 * Octave — la glissière commune (progression, volume) : un rail fin, un
 * remplissage en ÉCHELLE (dégradé pour la progression, rose plein pour le
 * volume), une tête qui paraît au survol, à la saisie et au focus. Un
 * `<input type="range">` invisible, AU-DESSUS, porte la souris, le clavier et
 * les lecteurs d'écran ; la zone de saisie fait 24 px de haut.
 *
 * Rien ne s'anime en continu : le remplissage et la tête sont posés à chaque
 * nouvelle valeur (`shell.css`).
 */

import { memo, type CSSProperties, type InputHTMLAttributes } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "style">;

interface RangeSliderProps extends InputProps {
  /** Ce qui est montré, de 0 à 1. */
  ratio: number;
  fill: "progress" | "volume";
  dragging?: boolean;
  className?: string;
}

export const RangeSlider = memo(function RangeSlider({ ratio, fill, dragging = false, className = "", disabled, ...input }: RangeSliderProps) {
  const at = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div className={`octave-range ${className}`} data-dragging={dragging ? "true" : "false"} data-disabled={disabled ? "true" : "false"}>
      <input
        type="range"
        disabled={disabled}
        {...input}
        className="octave-range-input absolute inset-0 z-[1] m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
      <div className="octave-range-rail">
        <div className="octave-range-fill" data-fill={fill} style={{ transform: `scaleX(${at})` }} />
      </div>
      <div className="octave-range-head" style={{ "--oc-at": at } as CSSProperties}>
        <span className="octave-range-dot" />
      </div>
    </div>
  );
});
