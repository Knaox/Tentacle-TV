import { useState, type CSSProperties } from "react";

import { markImageSeen, wasImageSeen } from "../../lib/seenImages";

interface FadeImageProps {
  src: string;
  alt: string;
  /** La couleur d'attente — celle de l'image (`imageColorOf`, lib/blurhashColor). Sans elle : l'encre de carte. */
  color?: string | null;
  /** La boîte : sa taille, son rayon, son ratio. */
  className?: string;
  /** L'image elle-même (`object-position`…). */
  imgClassName?: string;
  /** `lazy` par défaut ; `eager` pour ce qui est à l'écran dès le premier rendu. */
  loading?: "lazy" | "eager";
  style?: CSSProperties;
}

/**
 * L'image qui ne clignote pas (docs/REFONTE-UI.md) : sa COULEUR d'abord, puis UN fondu de
 * 220 ms ; déjà vue pendant la séance (`seenImages`), elle est là d'emblée, sans fondu. Jamais
 * de squelette qui scintille, jamais deux fondus (un squelette qui sort, une image qui entre).
 *
 * Pour une image hors carte. Une carte de la bibliothèque passe par `CardImage`, qui ajoute
 * le chargement à l'approche et les nouvelles tentatives.
 */
export function FadeImage({ src, alt, color, className, imgClassName, loading = "lazy", style }: FadeImageProps) {
  // L'état est attaché à l'ADRESSE : une autre image repart de zéro, sans effet.
  const [state, setState] = useState({ src, loaded: wasImageSeen(src), instant: wasImageSeen(src) });
  if (state.src !== src) setState({ src, loaded: wasImageSeen(src), instant: wasImageSeen(src) });

  return (
    <div className={`ui-image ${className ?? ""}`} style={color ? { ...style, backgroundColor: color } : style}>
      {src !== "" && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          draggable={false}
          data-loaded={state.loaded}
          data-instant={state.instant}
          className={imgClassName}
          onLoad={() => {
            markImageSeen(src);
            setState((s) => (s.src === src ? { ...s, loaded: true } : s));
          }}
        />
      )}
    </div>
  );
}
