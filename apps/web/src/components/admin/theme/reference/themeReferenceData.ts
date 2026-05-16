import { DEFAULT_THEME, themeToCssVariables } from "@tentacle-tv/theme";
import {
  CHRISTMAS_PRESET,
  EASTER_PRESET,
  HALLOWEEN_PRESET,
} from "../../../../theme/presets";

/* Pre-formatted reference blocks for the admin "theme reference" page. */

const CSS_VARIABLES_BLOCK = themeToCssVariables(DEFAULT_THEME.tokens, {
  includeReducedMotion: true,
});

const COMMON_SELECTORS_BLOCK = `/* === Tentacle TV — Common selectors for Custom CSS overrides === */

/* Page chrome */
html, body                                    /* Page background, font */
.brand-ambient                                /* Corner ambient halos */
header[data-host-chrome="topbar"]             /* Desktop top nav */
header[data-host-chrome="topbar-mobile"]      /* Mobile top nav */
nav.fixed.bottom-0                            /* Mobile bottom tab bar */
nav[aria-label="Primary"] a[aria-current="page"]  /* Active nav link */

/* Hero billboard */
.group\\/billboard                            /* Hero billboard container */

/* Cards (poster + episode + library grid) */
[class*="aspect-["][class*="overflow-hidden"][class*="rounded-md"]
.aspect-video[class*="rounded-md"]
[class*="aspect-[2/3]"][class*="rounded-md"]

/* Buttons */
button.bg-white                               /* CTA primary white pill */
button[class*="bg-[var(--brand-soft)]"]       /* Brand ghost button */
button[class*="bg-[var(--status-error-bg)]"]  /* Danger button */

/* Modals / overlays */
div[role="dialog"][aria-modal="true"]
div[role="menu"][aria-orientation="vertical"]

/* Avatar (user badge) */
button[aria-haspopup="menu"][class*="rounded-full"]

/* Scrollbar */
::-webkit-scrollbar-thumb
::-webkit-scrollbar-thumb:hover

/* Octopus mascot SVG (inline component) — themed via CSS vars:
 *   --brand, --brand-dark, --brand-accent, --brand-accent-light
 *   --octopus-iris (eye iris color, default #1E1B4B)
 *   --default-hat-display (set 'none' to hide pirate hat)
 *   --xmas-display, --easter-display, --halloween-display
 *     (set 'block' on exactly ONE to show that seasonal ornament). */`;

const KEYFRAMES_BLOCK = `/* === Tentacle TV — Animation keyframes (redefine to retarget motion) === */

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeSlideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.8; }
}

@keyframes breathe {
  0%, 100% { box-shadow: 0 0 15px rgba(var(--brand-rgb), 0.3); }
  50%      { box-shadow: 0 0 25px rgba(var(--brand-rgb), 0.5); }
}

@keyframes kenBurns {
  0%   { transform: scale(1) translate3d(0, 0, 0); }
  100% { transform: scale(1.18) translate3d(-2%, 1.2%, 0); }
}

@keyframes fadeOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(20px); }
}`;

const TAILWIND_UTILITIES_BLOCK = `/* === Tentacle TV — Tailwind utility → CSS var mapping ===
 * Override the var to affect every utility using it. */

bg-surface-0 → var(--surface-0)
bg-surface-1 → var(--surface-1)
bg-surface-2 → var(--surface-2)
bg-surface-3 → var(--surface-3)

bg-brand → var(--brand)
bg-brand/X → rgba(var(--brand-rgb), 0.X)
text-brand → var(--brand)
text-brand-light → var(--brand-light)
text-brand-dark → var(--brand-dark)
border-brand → var(--brand)

bg-tentacle-bg → var(--surface-0) (legacy)
bg-tentacle-surface → var(--surface-1) (legacy)
text-tentacle-accent → var(--brand) (legacy)

bg-status-success → var(--status-success)
bg-status-warning → var(--status-warning)
bg-status-error → var(--status-error)
bg-status-info → var(--status-info)

text-display-1 → 4.5rem  / weight 800 / tracking -0.025em
text-display-2 → 3rem    / weight 700 / tracking -0.022em
text-display-3 → 2rem    / weight 700 / tracking -0.020em
text-heading-1 → 1.5rem  / weight 600
text-heading-2 → 1.25rem / weight 600
text-heading-3 → 1.125rem / weight 600

backdrop-blur-xs → 2px`;

/**
 * The ONE block to copy-paste. Contains everything an AI (or a person) needs
 * to write a complete Tentacle TV theme: full CSS variables, every useful
 * selector, all keyframes, the Tailwind utility-to-var mapping, plus a
 * prompt template at the end. ~250 lines of context in a single paste.
 */
export const ALL_IN_ONE_REFERENCE = `${"=".repeat(78)}
TENTACLE TV — THEME REFERENCE (paste this entire block to an AI to build a theme)
${"=".repeat(78)}

Tentacle TV is a Jellyfin media client (React + Tailwind, dark cinematic baseline).
Below is the complete CSS surface area you can override via the Custom CSS panel.

${CSS_VARIABLES_BLOCK}

${COMMON_SELECTORS_BLOCK}

${KEYFRAMES_BLOCK}

${TAILWIND_UTILITIES_BLOCK}

${"=".repeat(78)}
PROMPT TEMPLATE — fill in your theme idea and paste to ChatGPT / Claude / etc.
${"=".repeat(78)}

You are an expert CSS designer. Using ONLY the variables, selectors, and keyframes
above, build me a custom CSS theme for Tentacle TV.

My theme idea: [REPLACE WITH YOUR IDEA — e.g. "synthwave neon pink and cyan with
Orbitron font and CRT scanlines", "warm coffee shop browns", "minimal black & white
brutalist", "fairy forest pastels with light mode", etc.]

Constraints:
- Output ONLY a CSS block starting with ":root {" — no prose, no markdown fences.
- Maintain WCAG AA contrast (>= 4.5:1 between text and its background).
- Wrap any animations you add with @media (prefers-reduced-motion: reduce) fallback.
- Keep --default-hat-display : block unless I asked you to hide the pirate hat.
- Do NOT redefine fonts unless I asked for it (Inter is the baseline).
- Do NOT change layout heights / spacing unless I asked for it.
- Add at most ONE decorative particle effect via body::before / body::after.
- The result must paste cleanly into Tentacle's "Custom CSS (Inline)" admin field.
`;

/** Working preset CSS — full content of each shipped seasonal preset. */
export const CHRISTMAS_REFERENCE = CHRISTMAS_PRESET.css;
export const EASTER_REFERENCE = EASTER_PRESET.css;
export const HALLOWEEN_REFERENCE = HALLOWEEN_PRESET.css;
