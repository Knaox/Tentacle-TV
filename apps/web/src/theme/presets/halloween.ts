import type { ThemePreset } from "./types";

/**
 * HALLOWEEN — atmosphère sombre/orange clairement perceptible.
 * Brand violet préservé pour les boutons et badges. Signaux saisonniers :
 * chapeau de sorcière sur le poulpe + yeux orange citrouille + halos orange &
 * vert toxique + lune en haut + 2 toiles d'araignées dans les coins +
 * brouillard nocturne animé en bas + glow/focus tintés orange.
 */
export const HALLOWEEN_PRESET: ThemePreset = {
  id: "halloween",
  nameKey: "presetHalloweenName",
  descriptionKey: "presetHalloweenDesc",
  swatch: ["#f97316", "#84cc16", "#0a0a0f"],
  // Brand teinté violet-orangé (#A35BB5) — violet préservé mais avec une
  // chaleur citrouille visible sur mobile/TV (sans toiles ni brouillard).
  tokens: {
    color: {
      brand: {
        base: "#A35BB5",
        soft: "rgba(163, 91, 181, 0.15)",
        ghost: "rgba(163, 91, 181, 0.18)",
        glow: "rgba(249, 115, 22, 0.45)",
      },
      border: {
        focus: "rgba(249, 115, 22, 0.85)",
      },
    },
  },
  css: `/* === Tentacle TV — HALLOWEEN === */
:root {
  --default-hat-display: none;
  --xmas-display: none;
  --easter-display: none;
  --halloween-display: block;

  /* Glow & focus orange citrouille — boutons restent brand violet */
  --brand-glow: rgba(249, 115, 22, 0.45);
  --border-focus: rgba(249, 115, 22, 0.85);
  /* Yeux du poulpe orange foncé (lisible, pas trop saturé) */
  --octopus-iris: #b45309;
}

/* Halos — lune top-right + orange citrouille en bas + vert toxique latéral */
.brand-ambient {
  background:
    radial-gradient(circle 200px at 92% 10%, rgba(255, 240, 200, 0.42), rgba(255, 240, 200, 0.10) 50%, transparent 80%),
    radial-gradient(ellipse 65% 45% at 12% 85%, rgba(249, 115, 22, 0.32), transparent 70%),
    radial-gradient(ellipse 45% 30% at 82% 70%, rgba(132, 204, 22, 0.18), transparent 70%),
    radial-gradient(ellipse 35% 25% at 40% 30%, rgba(139, 92, 246, 0.10), transparent 70%);
}

/* Deux toiles d'araignées (haut-gauche + bas-droite, bien visibles) */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><g stroke='rgba(255,255,255,0.32)' stroke-width='0.9' fill='none' stroke-linecap='round'><path d='M0,0 L200,200 M0,0 L200,150 M0,0 L200,100 M0,0 L200,50 M0,0 L150,200 M0,0 L100,200 M0,0 L60,200'/><path d='M30,30 Q60,40 80,80 M60,60 Q90,70 110,110 M90,90 Q120,100 140,140 M40,40 Q70,45 75,75 M70,70 Q100,80 105,105'/></g></svg>"),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><g stroke='rgba(255,255,255,0.26)' stroke-width='0.8' fill='none' stroke-linecap='round' transform='translate(200,200) scale(-1,-1)'><path d='M0,0 L200,200 M0,0 L200,150 M0,0 L200,100 M0,0 L150,200 M0,0 L100,200'/><path d='M30,30 Q60,40 80,80 M60,60 Q90,70 110,110 M40,40 Q70,45 75,75'/></g></svg>");
  background-position: top left, bottom right;
  background-size: 230px 230px, 200px 200px;
  background-repeat: no-repeat;
}

/* Brouillard nocturne au sol (lent, hypnotique) */
body::after {
  content: '';
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30vh;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(132, 204, 22, 0.05) 50%,
    rgba(249, 115, 22, 0.08) 100%);
  animation: tt-mist 9s ease-in-out infinite alternate;
}
@keyframes tt-mist {
  from { opacity: 0.65; transform: translateY(0); }
  to   { opacity: 1;    transform: translateY(-14px); }
}

@media (prefers-reduced-motion: reduce) {
  body::after { animation: none !important; }
}
`,
};
