import type { CSSProperties } from "react";
import { TaperedArm } from "./ui/TentacleArms";
import { TentacleFace } from "./ui/TentacleFace";
import { TentacleHat } from "./ui/TentacleHat";
import {
  ANTENNA_PATHS,
  ANTENNA_SEGMENTS,
  ARM_SEGMENTS,
  BACK_ARM_PATHS,
  BACK_ARM_SEGMENTS,
  FRONT_ARM_PATHS,
  SUCKERS,
} from "./ui/tentacleGeometry";

type Phase = "enter" | "clap" | "splash" | "exit";

interface SplashOctopusProps {
  phase: Phase;
  size?: number;
}

/**
 * Pivots de rotation des bras, à l'aplomb de leurs attaches sous le manteau.
 *
 * Ils étaient exprimés dans l'ancien viewBox 512×560 ; tels quels dans le repère
 * 240×240 ils tombaient hors du dessin, et les bras pivotaient autour d'un point
 * situé loin de leur base — le claquement partait en moulinet.
 */
const PIVOT_LEFT = "98px,176px";
const PIVOT_RIGHT = "142px,176px";
const UNPIVOT_LEFT = "-98px,-176px";
const UNPIVOT_RIGHT = "-142px,-176px";

/** Les bras du dessin, répartis par côté : seuls eux s'animent. */
const LEFT_BACK = BACK_ARM_PATHS.filter((_, i) => i === 0);
const RIGHT_BACK = BACK_ARM_PATHS.filter((_, i) => i === 1);
const LEFT_FRONT = FRONT_ARM_PATHS.filter((_, i) => i < 2);
const RIGHT_FRONT = FRONT_ARM_PATHS.filter((_, i) => i >= 2);

/** Les ventouses suivent leur côté : le tableau généré est plat, on le partage. */
const LEFT_SUCKERS = SUCKERS.filter((cup) => cup.cx < 120);
const RIGHT_SUCKERS = SUCKERS.filter((cup) => cup.cx >= 120);

/**
 * La mascotte dont les bras claquent, pour la transition vers le lecteur.
 *
 * Framer Motion ne gère pas `transform-origin` sur un `<g>` SVG : d'où des
 * keyframes CSS et le motif translate → rotate → translate.
 */
export function SplashOctopus({ phase, size = 180 }: SplashOctopusProps) {
  const keyframes = `
    @keyframes tentacle-clap-left {
      0%   { transform: translate(${PIVOT_LEFT}) rotate(0deg)   translate(${UNPIVOT_LEFT}); }
      14%  { transform: translate(${PIVOT_LEFT}) rotate(25deg)  translate(${UNPIVOT_LEFT}); }
      28%  { transform: translate(${PIVOT_LEFT}) rotate(-5deg)  translate(${UNPIVOT_LEFT}); }
      42%  { transform: translate(${PIVOT_LEFT}) rotate(22deg)  translate(${UNPIVOT_LEFT}); }
      57%  { transform: translate(${PIVOT_LEFT}) rotate(-3deg)  translate(${UNPIVOT_LEFT}); }
      78%  { transform: translate(${PIVOT_LEFT}) rotate(18deg)  translate(${UNPIVOT_LEFT}); }
      100% { transform: translate(${PIVOT_LEFT}) rotate(0deg)   translate(${UNPIVOT_LEFT}); }
    }
    @keyframes tentacle-clap-right {
      0%   { transform: translate(${PIVOT_RIGHT}) rotate(0deg)   translate(${UNPIVOT_RIGHT}); }
      14%  { transform: translate(${PIVOT_RIGHT}) rotate(-25deg) translate(${UNPIVOT_RIGHT}); }
      28%  { transform: translate(${PIVOT_RIGHT}) rotate(5deg)   translate(${UNPIVOT_RIGHT}); }
      42%  { transform: translate(${PIVOT_RIGHT}) rotate(-22deg) translate(${UNPIVOT_RIGHT}); }
      57%  { transform: translate(${PIVOT_RIGHT}) rotate(3deg)   translate(${UNPIVOT_RIGHT}); }
      78%  { transform: translate(${PIVOT_RIGHT}) rotate(-18deg) translate(${UNPIVOT_RIGHT}); }
      100% { transform: translate(${PIVOT_RIGHT}) rotate(0deg)   translate(${UNPIVOT_RIGHT}); }
    }
    @keyframes tentacle-splash-left {
      0%   { transform: translate(${PIVOT_LEFT}) rotate(0deg)   translate(${UNPIVOT_LEFT}); }
      100% { transform: translate(${PIVOT_LEFT}) rotate(-20deg) translate(${UNPIVOT_LEFT}); }
    }
    @keyframes tentacle-splash-right {
      0%   { transform: translate(${PIVOT_RIGHT}) rotate(0deg)  translate(${UNPIVOT_RIGHT}); }
      100% { transform: translate(${PIVOT_RIGHT}) rotate(20deg) translate(${UNPIVOT_RIGHT}); }
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
        <linearGradient id="sp-mantle" x1="40" y1="54" x2="200" y2="186" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-light)" />
          <stop offset="0.5" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-accent-deep)" />
        </linearGradient>
        <linearGradient id="sp-arm" x1="0" y1="170" x2="0" y2="235" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-deep)" />
          <stop offset="0.18" stopColor="var(--brand-dark)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id="sp-arm-back" x1="0" y1="160" x2="0" y2="215" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-deep)" />
          <stop offset="1" stopColor="var(--brand-accent-shadow)" />
        </linearGradient>
        <linearGradient id="sp-tube" x1="0" y1="78" x2="0" y2="156" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--octopus-tube)" />
          <stop offset="1" stopColor="var(--octopus-tube-deep)" />
        </linearGradient>
        <linearGradient id="sp-shine" x1="0" y1="54" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sp-glass" x1="0" y1="78" x2="0" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sp-hat" x1="0" y1="14" x2="0" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3C3450" />
          <stop offset="1" stopColor="#15111F" />
        </linearGradient>
        <linearGradient id="sp-band" x1="76" y1="0" x2="164" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="0.5" stopColor="var(--brand-mid)" />
          <stop offset="1" stopColor="var(--brand-accent)" />
        </linearGradient>
      </defs>

      {/* Les antennes ne claquent pas : elles restent hors des groupes animés. */}
      <g fill="none" stroke="url(#sp-arm-back)" strokeLinecap="round" strokeLinejoin="round">
        {ANTENNA_PATHS.map((d) => (
          <TaperedArm key={d} d={d} segments={ANTENNA_SEGMENTS} />
        ))}
      </g>

      <ArmSide
        style={leftStyle}
        back={LEFT_BACK}
        front={LEFT_FRONT}
        suckers={LEFT_SUCKERS}
      />
      <ArmSide
        style={rightStyle}
        back={RIGHT_BACK}
        front={RIGHT_FRONT}
        suckers={RIGHT_SUCKERS}
      />

      <TentacleFace
        mantleFill="url(#sp-mantle)"
        shineFill="url(#sp-shine)"
        tubeFill="url(#sp-tube)"
        glassFill="url(#sp-glass)"
      />
      <TentacleHat hatFill="url(#sp-hat)" bandFill="url(#sp-band)" />
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

interface ArmSideProps {
  style: CSSProperties;
  back: readonly string[];
  front: readonly string[];
  suckers: readonly { cx: number; cy: number; r: number }[];
}

/** Un côté de bras, animé en bloc autour de son pivot. */
function ArmSide({ style, back, front, suckers }: ArmSideProps) {
  return (
    <g style={style}>
      <g fill="none" stroke="url(#sp-arm-back)" strokeLinecap="round" strokeLinejoin="round">
        {back.map((d) => (
          <TaperedArm key={d} d={d} segments={BACK_ARM_SEGMENTS} />
        ))}
      </g>
      <g fill="none" stroke="url(#sp-arm)" strokeLinecap="round" strokeLinejoin="round">
        {front.map((d) => (
          <TaperedArm key={d} d={d} segments={ARM_SEGMENTS} />
        ))}
      </g>
      <g fill="#1B0B33" opacity="0.22">
        {suckers.map((cup) => (
          <circle key={`s-${cup.cx}-${cup.cy}`} cx={cup.cx + 0.7} cy={cup.cy + 0.9} r={cup.r * 1.18} />
        ))}
      </g>
      <g fill="#fff" opacity="0.26">
        {suckers.map((cup) => (
          <circle key={`c-${cup.cx}-${cup.cy}`} cx={cup.cx - 0.2} cy={cup.cy - 0.3} r={cup.r} />
        ))}
      </g>
    </g>
  );
}
