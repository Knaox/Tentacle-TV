/**
 * Seasonal ornaments overlaid on the Tentacle octopus mascot.
 * Each ornament group renders only when its corresponding CSS variable is set
 * to `block` by the active preset's Custom CSS — at most one is visible at a
 * time. The default pirate hat (in `TentacleSvg`) is hidden in parallel via
 * `--default-hat-display: none`.
 */
export function TentacleOrnaments() {
  return (
    <>
      <ChristmasOrnament />
      <EasterOrnament />
      <HalloweenOrnament />
    </>
  );
}

function ChristmasOrnament() {
  return (
    <g style={{ display: "var(--xmas-display, none)" }}>
      {/* Red cone — Santa hat body */}
      <path
        d="M175 110 Q205 35 256 12 Q310 35 337 110 Z"
        fill="#c0392b"
      />
      {/* Subtle highlight on the front of the cone */}
      <path
        d="M256 12 Q258 45 240 90 Q220 105 215 110"
        fill="none"
        stroke="rgba(255,255,255,0.20)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fluffy white brim */}
      <ellipse cx="256" cy="108" rx="92" ry="18" fill="#ffffff" />
      <ellipse cx="256" cy="103" rx="90" ry="6" fill="#f3f4f6" opacity="0.6" />
      {/* Pompon */}
      <circle cx="256" cy="14" r="17" fill="#ffffff" />
      <circle cx="250" cy="9" r="6" fill="#f9fafb" opacity="0.8" />
      {/* Tiny pine sprig on left tentacle */}
      <g transform="translate(95, 480)">
        <path d="M0 0 L-8 -14 L-4 -10 L0 -22 L4 -10 L8 -14 Z" fill="#16a34a" />
        <circle cx="0" cy="0" r="4" fill="#dc2626" />
      </g>
    </g>
  );
}

function EasterOrnament() {
  return (
    <g style={{ display: "var(--easter-display, none)" }}>
      {/* Left bunny ear */}
      <ellipse cx="215" cy="60" rx="22" ry="70" fill="#c4b5fd" stroke="#a78bfa" strokeWidth="2" />
      <ellipse cx="215" cy="68" rx="11" ry="52" fill="#f9a8d4" />
      {/* Right bunny ear */}
      <ellipse cx="297" cy="60" rx="22" ry="70" fill="#c4b5fd" stroke="#a78bfa" strokeWidth="2" />
      <ellipse cx="297" cy="68" rx="11" ry="52" fill="#f9a8d4" />
      {/* Decorative egg in a tentacle */}
      <g transform="translate(108, 488)">
        <ellipse cx="0" cy="0" rx="14" ry="19" fill="#fde047" />
        <path
          d="M-10 -10 Q0 -13 10 -10 M-10 0 Q0 -3 10 0 M-10 10 Q0 7 10 10"
          stroke="#a78bfa"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M-9 -5 Q0 -2 9 -5"
          stroke="#f9a8d4"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      {/* Tiny flower */}
      <g transform="translate(410, 470)">
        <circle cx="0" cy="0" r="6" fill="#fde047" />
        <circle cx="-9" cy="-3" r="5" fill="#f9a8d4" />
        <circle cx="9" cy="-3" r="5" fill="#f9a8d4" />
        <circle cx="-7" cy="7" r="5" fill="#f9a8d4" />
        <circle cx="7" cy="7" r="5" fill="#f9a8d4" />
        <circle cx="0" cy="0" r="3" fill="#fef3c7" />
      </g>
    </g>
  );
}

function HalloweenOrnament() {
  return (
    <g style={{ display: "var(--halloween-display, none)" }}>
      {/* Brim of the witch hat */}
      <ellipse cx="256" cy="112" rx="135" ry="20" fill="#0a0a0f" />
      <ellipse cx="256" cy="108" rx="128" ry="14" fill="#1a1a1a" />
      {/* Pointy crown — slight curve to one side for character */}
      <path
        d="M168 112 Q198 50 235 14 Q252 0 268 8 Q298 45 344 112 Z"
        fill="#0a0a0f"
      />
      {/* Bent tip */}
      <path
        d="M252 4 Q220 -18 198 -6 Q210 4 240 14 Z"
        fill="#0a0a0f"
      />
      {/* Subtle vertical lighting on cone */}
      <path
        d="M256 12 Q250 50 235 90"
        fill="none"
        stroke="rgba(249,115,22,0.25)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Orange band */}
      <path
        d="M156 107 Q156 95 170 92 L342 92 Q356 95 356 107 Q345 110 256 110 Q167 110 156 107 Z"
        fill="#f97316"
      />
      {/* Tiny jack-o-lantern emblem on the band */}
      <g transform="translate(256, 100)">
        <circle cx="0" cy="0" r="7" fill="#0a0a0f" />
        <path d="M-3 -1 L-1 1 L1 -1 M1 -1 L3 1" stroke="#f97316" strokeWidth="1.2" fill="none" />
        <path d="M-2 2 L0 4 L2 2" stroke="#f97316" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
      {/* Tiny bat flying near the tentacles */}
      <g transform="translate(415, 460)">
        <ellipse cx="0" cy="0" rx="4" ry="3" fill="#0a0a0f" />
        <path d="M-4 -1 Q-12 -6 -16 0 Q-10 2 -4 1 Z" fill="#0a0a0f" />
        <path d="M4 -1 Q12 -6 16 0 Q10 2 4 1 Z" fill="#0a0a0f" />
      </g>
    </g>
  );
}
