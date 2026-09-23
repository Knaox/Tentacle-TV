import { useState } from "react";
import { Film } from "lucide-react";

/**
 * L'affiche d'une lecture — ou, si elle ne se charge pas (média sans image,
 * serveur injoignable), un aplat au même format : jamais l'icône d'image
 * cassée du navigateur au milieu d'une carte.
 */
export function Poster({ src, width, height, className }: { src: string; width: number; height: number; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div aria-hidden style={{ width, height }} className={`${className} grid place-items-center text-content-quaternary`}>
        <Film size={Math.round(width / 3)} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      width={width}
      height={height}
      onError={() => setFailed(true)}
      className={`${className} object-cover`}
    />
  );
}
