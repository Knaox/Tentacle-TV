import type { ThemePreset } from "./types";

/**
 * EASTER — pastels printaniers perceptibles, brand violet préservé.
 * Signaux : oreilles de lapin sur le poulpe + halos pastels lavande/rose/jaune
 * clairement présents + grandes confettis pastels qui flottent + polka dots
 * fixes scattered en arrière-plan + glow tinté rose.
 */
export const EASTER_PRESET: ThemePreset = {
  id: "easter",
  nameKey: "presetEasterName",
  descriptionKey: "presetEasterDesc",
  swatch: ["#a78bfa", "#f9a8d4", "#fde047"],
  // Brand teinté lavande-rose (#B98ED4) — violet pastel printanier visible
  // sur mobile/TV (où il n'y a pas de polka-dots ni confettis CSS).
  tokens: {
    color: {
      brand: {
        base: "#B98ED4",
        soft: "rgba(185, 142, 212, 0.15)",
        ghost: "rgba(185, 142, 212, 0.18)",
        glow: "rgba(249, 168, 212, 0.45)",
      },
      border: {
        focus: "rgba(249, 168, 212, 0.85)",
      },
    },
  },
  css: `/* === Tentacle TV — EASTER === */
:root {
  --default-hat-display: none;
  --xmas-display: none;
  --easter-display: block;
  --halloween-display: none;

  /* Glow rose pastel (les boutons restent brand violet) */
  --brand-glow: rgba(249, 168, 212, 0.45);
  --border-focus: rgba(249, 168, 212, 0.85);
}

/* Halos pastels prominents */
.brand-ambient {
  background:
    radial-gradient(ellipse 60% 40% at 12% 10%, rgba(167, 139, 250, 0.30), transparent 70%),
    radial-gradient(ellipse 55% 40% at 88% 82%, rgba(249, 168, 212, 0.30), transparent 70%),
    radial-gradient(ellipse 35% 28% at 50% 60%, rgba(253, 224, 71, 0.14), transparent 70%);
}

/* Polka dots fixes en arrière-plan (décor printanier) */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background-image:
    radial-gradient(circle 7px at 8% 15%, rgba(249, 168, 212, 0.35) 50%, transparent 65%),
    radial-gradient(circle 6px at 22% 88%, rgba(167, 139, 250, 0.35) 50%, transparent 65%),
    radial-gradient(circle 8px at 92% 22%, rgba(253, 224, 71, 0.30) 50%, transparent 65%),
    radial-gradient(circle 6px at 78% 75%, rgba(134, 239, 172, 0.35) 50%, transparent 65%),
    radial-gradient(circle 7px at 50% 8%, rgba(147, 197, 253, 0.35) 50%, transparent 65%),
    radial-gradient(circle 5px at 15% 50%, rgba(252, 165, 165, 0.35) 50%, transparent 65%);
  background-attachment: fixed;
  background-repeat: no-repeat;
}

/* Confettis pastels qui flottent doucement, bien visibles */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background-image:
    radial-gradient(circle at 14% 25%, rgba(249, 168, 212, 0.65) 2px, transparent 2.8px),
    radial-gradient(circle at 35% 55%, rgba(253, 224, 71, 0.55) 1.8px, transparent 2.5px),
    radial-gradient(circle at 55% 30%, rgba(167, 139, 250, 0.65) 1.9px, transparent 2.6px),
    radial-gradient(circle at 75% 65%, rgba(134, 239, 172, 0.55) 2px, transparent 2.7px),
    radial-gradient(circle at 88% 20%, rgba(147, 197, 253, 0.55) 1.9px, transparent 2.6px);
  background-size: 320px 440px, 270px 360px, 340px 460px, 260px 340px, 300px 400px;
  animation: tt-pastel-float 38s linear infinite;
  opacity: 0.65;
}
@keyframes tt-pastel-float {
  from { background-position: 0 -150px, 0 -150px, 0 -150px, 0 -150px, 0 -150px; }
  to   { background-position: 0 100vh, 40px 100vh, -20px 100vh, 30px 100vh, -10px 100vh; }
}

@media (prefers-reduced-motion: reduce) {
  body::before { animation: none !important; opacity: 0.4; }
}
`,
};
