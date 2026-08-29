import { useState, type ImgHTMLAttributes } from "react";

interface FadeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  duration?: number;
}

export function FadeImage({ duration = 0.3, style, onLoad, onError, ...props }: FadeImageProps) {
  /* L'échec suit l'ADRESSE. Sans cela, une liste recyclée — épisodes, casting —
   * gardait une case vide sur une image devenue valide, jusqu'au démontage. */
  const [state, setState] = useState({ src: props.src, loaded: false, errored: false });
  if (state.src !== props.src) setState({ src: props.src, loaded: false, errored: false });
  const { loaded, errored } = state;

  if (errored) return null;

  return (
    <img
      // Décodage hors du fil principal par défaut. Ce composant ne sert que
      // dans des listes — épisodes, casting — parcourues au défilement : c'est
      // exactement le cas où transformer les octets en pixels sur le fil qui
      // gère aussi le défilement se ressent. Placé AVANT le spread, un
      // appelant garde la main s'il a besoin d'un décodage synchrone.
      decoding="async"
      {...props}
      onLoad={(e) => {
        setState((s) => (s.src === props.src ? { ...s, loaded: true } : s));
        onLoad?.(e);
      }}
      onError={(e) => {
        setState((s) => (s.src === props.src ? { ...s, errored: true } : s));
        onError?.(e);
      }}
      style={{
        ...style,
        opacity: loaded ? 1 : 0,
        transition: `opacity ${duration}s ease`,
      }}
    />
  );
}
