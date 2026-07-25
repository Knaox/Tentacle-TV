import { useState, type ImgHTMLAttributes } from "react";

interface FadeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  duration?: number;
}

export function FadeImage({ duration = 0.3, style, onLoad, onError, ...props }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

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
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setErrored(true);
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
