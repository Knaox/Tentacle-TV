import type { CSSProperties } from "react";
import { TentacleFace } from "./ui/TentacleFace";
import { TentacleHat } from "./ui/TentacleHat";
import {
  BACK_ARM_PATHS,
  FRONT_ARM_PATHS,
  SUCKERS,
  SUCKER_SHADOW,
} from "./ui/tentacleGeometry";

type Phase = "enter" | "clap" | "splash" | "exit";

interface SplashOctopusProps {
  phase: Phase;
  size?: number;
}

/**
 * Pivots de rotation, un par côté, au barycentre des attaches du bras avant
 * (épaule, y≈98) et de la patte arrière (y≈154) : les deux pièces d'un même
 * côté tournent autour du MÊME point, sinon le côté se disloque.
 *
 * Ils sont dans le repère 240×240 du dessin — les précédents, exprimés dans un
 * viewBox disparu, faisaient partir le claquement en moulinet.
 */
const PIVOT_LEFT = "89px,126px";
const PIVOT_RIGHT = "151px,126px";
const UNPIVOT_LEFT = "-89px,-126px";
const UNPIVOT_RIGHT = "-151px,-126px";

/**
 * Les bras du dessin, par côté. Le générateur écrit toujours [gauche, droite]
 * — `brand/generate-svg.py` produit le côté gauche puis son miroir.
 */
const LEFT_BACK = BACK_ARM_PATHS[0];
const RIGHT_BACK = BACK_ARM_PATHS[1];
const LEFT_FRONT = FRONT_ARM_PATHS[0];
const RIGHT_FRONT = FRONT_ARM_PATHS[1];

/** Les ventouses suivent leur côté : le tableau généré est plat, on le partage. */
const LEFT_SUCKERS = SUCKERS.filter((cup) => cup.cx < 120);
const RIGHT_SUCKERS = SUCKERS.filter((cup) => cup.cx >= 120);

/**
 * La mascotte dont les bras claquent, pour la transition vers le lecteur.
 *
 * Framer Motion ne gère pas `transform-origin` sur un `<g>` SVG : d'où des
 * keyframes CSS et le motif translate → rotate → translate. Les angles sont
 * plus faibles que sur l'ancien dessin : les bras enlacent l'écran, un grand
 * débattement les en décollerait trop.
 *
 * Chaque côté anime DEUX groupes (la patte derrière, le bras avant devant) avec
 * les mêmes keyframes : l'ordre des plans — pattes, tête et écran, chapeau,
 * bras avant — ne survivrait pas à un groupe unique par côté.
 */
export function SplashOctopus({ phase, size = 180 }: SplashOctopusProps) {
  const keyframes = `
    @keyframes tentacle-clap-left {
      0%   { transform: translate(${PIVOT_LEFT}) rotate(0deg)   translate(${UNPIVOT_LEFT}); }
      14%  { transform: translate(${PIVOT_LEFT}) rotate(16deg)  translate(${UNPIVOT_LEFT}); }
      28%  { transform: translate(${PIVOT_LEFT}) rotate(-4deg)  translate(${UNPIVOT_LEFT}); }
      42%  { transform: translate(${PIVOT_LEFT}) rotate(14deg)  translate(${UNPIVOT_LEFT}); }
      57%  { transform: translate(${PIVOT_LEFT}) rotate(-2deg)  translate(${UNPIVOT_LEFT}); }
      78%  { transform: translate(${PIVOT_LEFT}) rotate(11deg)  translate(${UNPIVOT_LEFT}); }
      100% { transform: translate(${PIVOT_LEFT}) rotate(0deg)   translate(${UNPIVOT_LEFT}); }
    }
    @keyframes tentacle-clap-right {
      0%   { transform: translate(${PIVOT_RIGHT}) rotate(0deg)   translate(${UNPIVOT_RIGHT}); }
      14%  { transform: translate(${PIVOT_RIGHT}) rotate(-16deg) translate(${UNPIVOT_RIGHT}); }
      28%  { transform: translate(${PIVOT_RIGHT}) rotate(4deg)   translate(${UNPIVOT_RIGHT}); }
      42%  { transform: translate(${PIVOT_RIGHT}) rotate(-14deg) translate(${UNPIVOT_RIGHT}); }
      57%  { transform: translate(${PIVOT_RIGHT}) rotate(2deg)   translate(${UNPIVOT_RIGHT}); }
      78%  { transform: translate(${PIVOT_RIGHT}) rotate(-11deg) translate(${UNPIVOT_RIGHT}); }
      100% { transform: translate(${PIVOT_RIGHT}) rotate(0deg)   translate(${UNPIVOT_RIGHT}); }
    }
    @keyframes tentacle-splash-left {
      0%   { transform: translate(${PIVOT_LEFT}) rotate(0deg)   translate(${UNPIVOT_LEFT}); }
      100% { transform: translate(${PIVOT_LEFT}) rotate(-14deg) translate(${UNPIVOT_LEFT}); }
    }
    @keyframes tentacle-splash-right {
      0%   { transform: translate(${PIVOT_RIGHT}) rotate(0deg)  translate(${UNPIVOT_RIGHT}); }
      100% { transform: translate(${PIVOT_RIGHT}) rotate(14deg) translate(${UNPIVOT_RIGHT}); }
    }
  `;

  const leftStyle = armStyle(phase, "left");
  const rightStyle = armStyle(phase, "right");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{keyframes}</style>
        <linearGradient id="sp-head" x1="0" y1="26" x2="0" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--octopus-head-light, #C4B5FD)" />
          <stop offset="0.5" stopColor="var(--brand-mid)" />
          <stop offset="1" stopColor="var(--octopus-mid, #D946EF)" />
        </linearGradient>
        <linearGradient id="sp-shine" x1="0" y1="34" x2="0" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sp-screen" x1="0" y1="104" x2="0" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--octopus-tube)" />
          <stop offset="1" stopColor="var(--octopus-tube-deep)" />
        </linearGradient>
        <linearGradient id="sp-frame" x1="46" y1="26" x2="196" y2="214" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-light)" />
          <stop offset="0.42" stopColor="var(--octopus-mid, #D946EF)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id="sp-arm" x1="0" y1="118" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-mid-deep)" />
          <stop offset="0.4" stopColor="var(--octopus-mid, #D946EF)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id="sp-play" x1="114" y1="134" x2="142" y2="166" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-accent-light)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id="sp-hat" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3C3450" />
          <stop offset="1" stopColor="#15111F" />
        </linearGradient>
      </defs>

      {/* Pattes arrière : sous la tête et l'écran */}
      <g style={leftStyle} fill="url(#sp-arm)">
        <path d={LEFT_BACK} />
      </g>
      <g style={rightStyle} fill="url(#sp-arm)">
        <path d={RIGHT_BACK} />
      </g>

      <TentacleFace
        headFill="url(#sp-head)"
        shineFill="url(#sp-shine)"
        screenFill="url(#sp-screen)"
        frameFill="url(#sp-frame)"
        playFill="url(#sp-play)"
      />
      <TentacleHat hatFill="url(#sp-hat)" bandFill="url(#sp-frame)" />

      {/* Bras avant : par-dessus l'écran, chacun avec ses ventouses */}
      <FrontArm style={leftStyle} d={LEFT_FRONT} suckers={LEFT_SUCKERS} />
      <FrontArm style={rightStyle} d={RIGHT_FRONT} suckers={RIGHT_SUCKERS} />
    </svg>
  );
}

function armStyle(phase: Phase, side: "left" | "right"): CSSProperties {
  if (phase === "clap") {
    return { animation: `tentacle-clap-${side} 0.9s ease-in-out` };
  }
  if (phase === "splash" || phase === "exit") {
    return { animation: `tentacle-splash-${side} 0.35s ease-out forwards` };
  }
  return {};
}

interface FrontArmProps {
  style: CSSProperties;
  d: string;
  suckers: readonly { cx: number; cy: number; r: number }[];
}

/** Un bras avant animé, forme pleine, avec ses ventouses ombrées. */
function FrontArm({ style, d, suckers }: FrontArmProps) {
  return (
    <g style={style}>
      <path d={d} fill="url(#sp-arm)" />
      <g fill="#1B0B33" opacity="0.22">
        {suckers.map((cup) => (
          <circle
            key={`s-${cup.cx}-${cup.cy}`}
            cx={cup.cx + SUCKER_SHADOW.x}
            cy={cup.cy + SUCKER_SHADOW.y}
            r={cup.r * SUCKER_SHADOW.scale}
          />
        ))}
      </g>
      <g fill="#FBCFE8" opacity="0.8">
        {suckers.map((cup) => (
          <circle key={`c-${cup.cx}-${cup.cy}`} cx={cup.cx - 0.2} cy={cup.cy - 0.3} r={cup.r} />
        ))}
      </g>
    </g>
  );
}
