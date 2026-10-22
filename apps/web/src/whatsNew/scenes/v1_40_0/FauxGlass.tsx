import type { CSSProperties, ReactNode } from "react";
import { LiquidGlass, type LiquidGlassLevel, type LiquidGlassShape } from "../../../theme/glass";
import { Place, type Animated, type Placed } from "../Place";

interface FauxGlassProps extends Placed, Animated {
  /** Le niveau du matériau, comme dans l'app : `clear` sur la vidéo, `regular` pour un panneau de texte. */
  level?: LiquidGlassLevel;
  shape?: LiquidGlassShape;
  /** Glyphes posés sur un MÉDIA (le lecteur) : blancs et leur halo, comme le lecteur ; sinon le ton du dessous. */
  onMedia?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Hors du mode natif (crochet de développement, banc) : un verre d'avant, discret — la scène ne s'y montre pas sinon. */
const FALLBACK: CSSProperties = {
  background: "rgba(var(--scrim-media-rgb), 0.28)",
  backdropFilter: "blur(10px) saturate(1.6)",
  WebkitBackdropFilter: "blur(10px) saturate(1.6)",
};

/** Les glyphes d'une surface : au ton mesuré du dessous (`data-lg-tone`), ou blancs à halo sur la vidéo. */
const GLYPHS: CSSProperties = { color: "var(--lg-glyph, var(--on-media-primary))", textShadow: "var(--lg-glyph-text-shadow, none)" };
const MEDIA_GLYPHS: CSSProperties = { color: "var(--on-media-primary)", textShadow: "var(--lg-media-label-shadow)" };

/**
 * Une surface de la scène : la VRAIE primitive du verre (`LiquidGlass`,
 * lentille de la page) — réfraction au biseau calculée pour sa forme, lumière
 * du bord qui éclaircit le dessous, glyphes au ton du dessous ; rien de
 * repeint ici. Sur la vidéo, l'app pose le verre NATIF (`clear`) que la scène
 * ne peut pas emprunter : la lentille `clear` de la page en est l'image la
 * plus proche. Seul le placement passe par `Place` (transform, opacité).
 */
export function FauxGlass({
  level = "regular", shape = "capsule", onMedia = false, className, style, children, ...place
}: FauxGlassProps) {
  return (
    <Place {...place}>
      <LiquidGlass
        level={level}
        shape={shape}
        className={`relative h-full w-full ${className ?? ""}`}
        style={{ ...(onMedia ? MEDIA_GLYPHS : GLYPHS), ...style }}
        fallbackClassName={shape === "rounded" ? "rounded-2xl" : "rounded-full"}
        fallbackStyle={FALLBACK}
      >
        {children}
      </LiquidGlass>
    </Place>
  );
}
