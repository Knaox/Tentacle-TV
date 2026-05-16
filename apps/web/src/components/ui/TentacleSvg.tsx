import { useId, type CSSProperties } from "react";
import { TentacleOrnaments } from "./TentacleOrnaments";

interface TentacleSvgProps {
  size: number;
  style?: CSSProperties;
}

/**
 * Inline version of `/tentacle-logo-pirate.svg`. The original is also served
 * as a static file (referenced by URL in plugin iframes and a few legacy
 * `<img>` usages); this component is for the host app, where CSS variables
 * resolve and brand overrides propagate. Gradient IDs are namespaced via
 * `useId()` so multiple instances on the same page don't collide.
 *
 * Theming map (lossless when default tokens active) :
 *   #8B5CF6 → var(--brand)
 *   #7C3AED → var(--brand-dark)
 *   #EC4899 → var(--brand-accent)
 *   #F472B6 → var(--brand-accent-light)
 *   Mid-stops (#A855F7, #9333EA, #DB2777) derived via `color-mix` so they
 *   still blend smoothly when the admin overrides brand/accent.
 */
export function TentacleSvg({ size, style }: TentacleSvgProps) {
  const u = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const ids = {
    body: `tg-body-${u}`,
    t1: `tg-t1-${u}`,
    t2: `tg-t2-${u}`,
    cheek: `tg-cheek-${u}`,
    shine: `tg-shine-${u}`,
    hat: `tg-hat-${u}`,
    band: `tg-band-${u}`,
    skull: `tg-skull-${u}`,
    shadow: `tg-shadow-${u}`,
    hatShadow: `tg-hatshadow-${u}`,
  };
  const midBody = "color-mix(in srgb, var(--brand) 50%, var(--brand-accent) 50%)";
  const midT2 = "color-mix(in srgb, var(--brand-dark) 50%, var(--brand-accent-light) 50%)";
  const midT1End = "color-mix(in srgb, var(--brand-accent) 70%, black)";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 560"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={ids.body} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="50%" stopColor={midBody} />
          <stop offset="100%" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id={ids.t1} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--brand-dark)" />
          <stop offset="100%" stopColor={midT1End} />
        </linearGradient>
        <linearGradient id={ids.t2} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={midT2} />
          <stop offset="100%" stopColor="var(--brand-accent-light)" />
        </linearGradient>
        <linearGradient id={ids.cheek} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9A8D4" />
          <stop offset="100%" stopColor="var(--brand-accent-light)" />
        </linearGradient>
        <linearGradient id={ids.shine} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.hat} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2D2D2D" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </linearGradient>
        <linearGradient id={ids.band} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="50%" stopColor={midBody} />
          <stop offset="100%" stopColor="var(--brand-accent)" />
        </linearGradient>
        <linearGradient id={ids.skull} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <filter id={ids.shadow} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="var(--brand-dark)" floodOpacity="0.3" />
        </filter>
        <filter id={ids.hatShadow} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Back tentacles */}
      <path d="M160 358 Q120 418 100 468 Q85 508 110 528 Q130 543 145 518 Q160 493 155 448 Q152 418 170 388" fill={`url(#${ids.t1})`} opacity="0.85" />
      <path d="M352 358 Q392 418 412 468 Q427 508 402 528 Q382 543 367 518 Q352 493 357 448 Q360 418 342 388" fill={`url(#${ids.t1})`} opacity="0.85" />
      {/* Far tentacles */}
      <path d="M140 348 Q90 388 60 448 Q40 498 65 523 Q88 546 100 508 Q115 468 120 428 Q125 398 150 368" fill={`url(#${ids.t2})`} opacity="0.8" />
      <path d="M372 348 Q422 388 452 448 Q472 498 447 523 Q424 546 412 508 Q397 468 392 428 Q387 398 362 368" fill={`url(#${ids.t2})`} opacity="0.8" />
      {/* Front tentacles */}
      <path d="M185 363 Q165 428 150 478 Q138 518 160 536 Q180 550 188 520 Q195 490 195 448 Q195 413 200 383" fill={`url(#${ids.t1})`} />
      <path d="M327 363 Q347 428 362 478 Q374 518 352 536 Q332 550 324 520 Q317 490 317 448 Q317 413 312 383" fill={`url(#${ids.t1})`} />
      <path d="M220 373 Q210 438 205 488 Q200 523 220 538 Q240 548 242 516 Q244 484 240 448 Q237 418 235 388" fill={`url(#${ids.t2})`} />
      <path d="M292 373 Q302 438 307 488 Q312 523 292 538 Q272 548 270 516 Q268 484 272 448 Q275 418 277 388" fill={`url(#${ids.t2})`} />

      {/* Suction cups */}
      <circle cx="108" cy="498" r="5" fill="#DDD6FE" opacity="0.5" />
      <circle cx="150" cy="506" r="5" fill="#DDD6FE" opacity="0.5" />
      <circle cx="215" cy="510" r="4" fill="#DDD6FE" opacity="0.5" />
      <circle cx="297" cy="510" r="4" fill="#DDD6FE" opacity="0.5" />
      <circle cx="362" cy="506" r="5" fill="#DDD6FE" opacity="0.5" />
      <circle cx="404" cy="498" r="5" fill="#DDD6FE" opacity="0.5" />
      <circle cx="95" cy="473" r="4" fill="#DDD6FE" opacity="0.4" />
      <circle cx="145" cy="483" r="4" fill="#DDD6FE" opacity="0.4" />
      <circle cx="210" cy="488" r="3.5" fill="#DDD6FE" opacity="0.4" />
      <circle cx="302" cy="488" r="3.5" fill="#DDD6FE" opacity="0.4" />
      <circle cx="367" cy="483" r="4" fill="#DDD6FE" opacity="0.4" />
      <circle cx="417" cy="473" r="4" fill="#DDD6FE" opacity="0.4" />

      {/* Body */}
      <ellipse cx="256" cy="268" rx="130" ry="140" fill={`url(#${ids.body})`} filter={`url(#${ids.shadow})`} />
      <ellipse cx="240" cy="223" rx="80" ry="70" fill={`url(#${ids.shine})`} opacity="0.5" />

      {/* Eyes */}
      <ellipse cx="210" cy="263" rx="38" ry="42" fill="white" />
      <ellipse cx="302" cy="263" rx="38" ry="42" fill="white" />
      <ellipse cx="215" cy="268" rx="22" ry="26" fill="var(--octopus-iris, #1E1B4B)" />
      <ellipse cx="307" cy="268" rx="22" ry="26" fill="var(--octopus-iris, #1E1B4B)" />
      <ellipse cx="218" cy="266" rx="12" ry="14" fill="#0F0A2A" />
      <ellipse cx="310" cy="266" rx="12" ry="14" fill="#0F0A2A" />
      <circle cx="224" cy="256" r="8" fill="white" opacity="0.9" />
      <circle cx="316" cy="256" r="8" fill="white" opacity="0.9" />
      <circle cx="212" cy="272" r="4" fill="white" opacity="0.5" />
      <circle cx="304" cy="272" r="4" fill="white" opacity="0.5" />

      {/* Eyebrows + Smile */}
      <path d="M180 230 Q195 220 225 226" stroke="var(--brand-dark)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M287 226 Q317 220 332 230" stroke="var(--brand-dark)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M228 316 Q256 343 284 316" stroke="var(--brand-dark)" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Cheeks */}
      <ellipse cx="170" cy="303" rx="20" ry="14" fill={`url(#${ids.cheek})`} opacity="0.45" />
      <ellipse cx="342" cy="303" rx="20" ry="14" fill={`url(#${ids.cheek})`} opacity="0.45" />

      {/* === DEFAULT PIRATE HAT (hidden by themed presets via --default-hat-display: none) === */}
      <g style={{ display: "var(--default-hat-display, block)" }}>
        <ellipse cx="256" cy="155" rx="155" ry="22" fill="#1A1A1A" filter={`url(#${ids.hatShadow})`} />
        <ellipse cx="256" cy="153" rx="150" ry="18" fill="#2D2D2D" />
        <ellipse cx="256" cy="151" rx="145" ry="14" fill={`url(#${ids.hat})`} />
        <path d="M145 155 Q140 100 165 60 Q195 20 256 8 Q317 20 347 60 Q372 100 367 155 Z" fill={`url(#${ids.hat})`} filter={`url(#${ids.hatShadow})`} />
        <path d="M175 140 Q178 95 200 62 Q225 32 256 25 Q280 32 300 55 Q310 72 310 90" fill="white" opacity="0.06" />
        <path d="M152 145 Q155 138 165 135 Q210 128 256 126 Q302 128 347 135 Q357 138 360 145 Q357 152 347 155 Q302 162 256 164 Q210 162 165 155 Q155 152 152 145 Z" fill={`url(#${ids.band})`} />
        <ellipse cx="256" cy="88" rx="18" ry="20" fill={`url(#${ids.skull})`} />
        <ellipse cx="256" cy="95" rx="12" ry="8" fill={`url(#${ids.skull})`} />
        <ellipse cx="249" cy="84" rx="5" ry="6" fill="#1A1A1A" />
        <ellipse cx="263" cy="84" rx="5" ry="6" fill="#1A1A1A" />
        <path d="M254 92 L256 96 L258 92" fill="#1A1A1A" stroke="#1A1A1A" strokeWidth="1" />
        <path d="M248 100 L264 100" stroke="#1A1A1A" strokeWidth="1.5" />
        <line x1="251" y1="100" x2="251" y2="103" stroke="#1A1A1A" strokeWidth="1" />
        <line x1="256" y1="100" x2="256" y2="103" stroke="#1A1A1A" strokeWidth="1" />
        <line x1="261" y1="100" x2="261" y2="103" stroke="#1A1A1A" strokeWidth="1" />
        <path d="M228 78 Q245 95 270 108" stroke={`url(#${ids.skull})`} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M228 108 Q245 95 270 78" stroke={`url(#${ids.skull})`} strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="226" cy="76" r="4" fill={`url(#${ids.skull})`} />
        <circle cx="226" cy="110" r="4" fill={`url(#${ids.skull})`} />
        <circle cx="272" cy="76" r="4" fill={`url(#${ids.skull})`} />
        <circle cx="272" cy="110" r="4" fill={`url(#${ids.skull})`} />
        <path d="M145 155 Q150 148 170 145" stroke="#3D3D3D" strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M367 155 Q362 148 342 145" stroke="#3D3D3D" strokeWidth="1.5" fill="none" opacity="0.5" />
      </g>

      {/* === THEMED ORNAMENTS — shown one at a time via CSS preset variables === */}
      <TentacleOrnaments />
    </svg>
  );
}
