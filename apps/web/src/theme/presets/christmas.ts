import type { ThemePreset } from "./types";

/**
 * CHRISTMAS — festive et perceptible mais cohérent.
 * Brand violet préservé (boutons, avatars, badges actifs).
 * Signaux saisonniers : bonnet sur le poulpe + halos bicolores rouge/vert
 * clairement visibles + guirlande de lumières en haut + neige animée +
 * focus ring & glow tintés rouge.
 */
export const CHRISTMAS_PRESET: ThemePreset = {
  id: "christmas",
  nameKey: "presetChristmasName",
  descriptionKey: "presetChristmasDesc",
  swatch: ["#dc2626", "#16a34a", "#fbbf24"],
  // Brand teinté prune-rouge (#9A4570) — violet reconnaissable, identité
  // saisonnière visible sur mobile/TV (où il n'y a pas de particules CSS).
  tokens: {
    color: {
      brand: {
        base: "#9A4570",
        soft: "rgba(154, 69, 112, 0.15)",
        ghost: "rgba(154, 69, 112, 0.18)",
        glow: "rgba(220, 38, 38, 0.40)",
      },
      border: {
        focus: "rgba(220, 38, 38, 0.85)",
      },
    },
  },
  css: `/* === Tentacle TV — CHRISTMAS === */
:root {
  --default-hat-display: none;
  --xmas-display: block;
  --easter-display: none;
  --halloween-display: none;

  /* Glow & focus prennent une teinte rouge cadeau (le brand violet
   * reste actif sur boutons, badges, avatar, progress bars). */
  --brand-glow: rgba(220, 38, 38, 0.4);
  --border-focus: rgba(220, 38, 38, 0.85);
}

/* Halos d'ambiance bicolores rouge/vert clairement visibles */
.brand-ambient {
  background:
    radial-gradient(ellipse 65% 40% at 12% 8%, rgba(220, 38, 38, 0.28), transparent 70%),
    radial-gradient(ellipse 55% 40% at 88% 85%, rgba(22, 163, 74, 0.22), transparent 70%),
    radial-gradient(ellipse 30% 22% at 50% 50%, rgba(139, 92, 246, 0.10), transparent 70%);
}

/* Guirlande de lumières en haut de page (jaune/rouge/vert/bleu) */
body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 18px;
  pointer-events: none;
  z-index: 9998;
  background-image:
    radial-gradient(circle 3.5px at 40px 8px, #fbbf24 60%, transparent 65%),
    radial-gradient(circle 3.5px at 100px 12px, #ef4444 60%, transparent 65%),
    radial-gradient(circle 3.5px at 160px 8px, #22c55e 60%, transparent 65%),
    radial-gradient(circle 3.5px at 220px 12px, #3b82f6 60%, transparent 65%);
  background-size: 260px 18px;
  background-repeat: repeat-x;
  filter: drop-shadow(0 0 6px rgba(255, 220, 100, 0.6));
  animation: tt-xmas-twinkle 2.2s ease-in-out infinite alternate;
}
@keyframes tt-xmas-twinkle {
  from { opacity: 0.55; }
  to   { opacity: 1; }
}

/* Chute de neige notable — 6 nappes décalées */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background-image:
    radial-gradient(circle at 12% 20%, rgba(255,255,255,0.85) 1.6px, transparent 2.4px),
    radial-gradient(circle at 28% 50%, rgba(255,255,255,0.7) 1.3px, transparent 2px),
    radial-gradient(circle at 45% 30%, rgba(255,255,255,0.85) 1.5px, transparent 2.2px),
    radial-gradient(circle at 62% 65%, rgba(255,255,255,0.7) 1.4px, transparent 2.1px),
    radial-gradient(circle at 80% 25%, rgba(255,255,255,0.85) 1.6px, transparent 2.4px),
    radial-gradient(circle at 92% 55%, rgba(255,255,255,0.7) 1.3px, transparent 2px);
  background-size: 240px 260px, 200px 220px, 220px 240px, 180px 200px, 240px 260px, 200px 220px;
  animation: tt-snow-fall 28s linear infinite;
  opacity: 0.72;
}
@keyframes tt-snow-fall {
  from { background-position: 0 -120px, 0 -120px, 0 -120px, 0 -120px, 0 -120px, 0 -120px; }
  to   { background-position: 0 100vh, 40px 100vh, -30px 100vh, 50px 100vh, -20px 100vh, 30px 100vh; }
}

@media (prefers-reduced-motion: reduce) {
  body::before { animation: none !important; opacity: 0.4; }
  body::after { animation: none !important; opacity: 0.8; }
}
`,
};
