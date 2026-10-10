import { memo, type CSSProperties } from "react";
import { pipFrameRadii, type PipFrame } from "./pipGeometry";

/**
 * Le cadre du PiP : une ombre, un liseré, un filet de lumière — rien qui
 * reçoive la souris.
 *
 * La vidéo est la fenêtre de mpv, collée SOUS celle-ci, à `shadow + bezel` de
 * son bord (la colle KWin, ou la coquille sur macOS) : ses coins sont carrés, et rien ne rend le bureau
 * à travers une fenêtre opaque. Le liseré, OPAQUE, les recouvre et dessine
 * l'arrondi — percé au centre d'un trou arrondi où la vidéo se voit. L'ombre
 * vit dans la marge transparente autour : du noir, la seule couleur que cette
 * surface à alpha compose juste (cf. `DesktopPlayerControls`).
 *
 * Sobre et neutre, sur fond clair comme sombre (retour de Damien : « trop
 * rose ») : un liseré presque noir — le bord de l'écran, pas un ornement —,
 * cerné de DEUX filets d'un point, un clair dedans (qui le détache d'une page
 * sombre) et un sombre dehors (d'une page claire). Au survol, le filet clair
 * s'éclaire, en fondu d'OPACITÉ seulement ; plus aucune couleur de marque.
 */

/**
 * L'ombre tient dans la marge (`pip/pipFrame.ts`) : rien de coupé net au bord
 * de la fenêtre. 14 px sous Linux ; 4 ailleurs, où le système tient le bord
 * pour le redimensionnement — une ombre serrée.
 */
function shadowFor(margin: number): string {
  if (margin >= 12) return "0 6px 14px -4px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.45)";
  return `0 1px ${String(Math.max(1, margin - 1))}px rgba(0, 0, 0, 0.5)`;
}
/** Presque noir, jamais du noir pur : le bord de l'image se lit encore. */
const BEZEL = "#0c0c0e";
/** Les deux filets : sombre dehors (fond clair), clair dedans (fond sombre). */
const HAIRLINES = "0 0 0 1px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.09)";
/** Le filet clair, survolé. */
const HAIRLINE_LIT = "inset 0 0 0 1px rgba(255, 255, 255, 0.24)";

/**
 * Un anneau : le fond peint sur la marge intérieure seulement, le contenu
 * percé — sa boîte de contenu garde l'arrondi, réduit de l'épaisseur. Le
 * Chromium d'Electron (la seule cible) connaît `mask-composite`.
 */
function ring(width: number, background: string): CSSProperties {
  return {
    padding: width,
    background,
    mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  };
}

export const PipChrome = memo(function PipChrome({ frame, lit }: { frame: PipFrame; lit: boolean }) {
  if (frame.bezel === 0) return null;
  const { outer } = pipFrameRadii(frame);
  const box: CSSProperties = { inset: frame.shadow, borderRadius: outer };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* L'ombre : son propre fond est transparent, elle ne peint que dehors. */}
      <div className="absolute" style={{ ...box, boxShadow: shadowFor(frame.shadow) }} />
      <div className="absolute" style={{ ...box, ...ring(frame.bezel, BEZEL) }} />
      <div className="absolute" style={{ ...box, boxShadow: HAIRLINES }} />
      <div
        className={`absolute transition-opacity duration-200 motion-reduce:transition-none ${lit ? "opacity-100" : "opacity-0"}`}
        style={{ ...box, boxShadow: HAIRLINE_LIT }}
      />
    </div>
  );
});
