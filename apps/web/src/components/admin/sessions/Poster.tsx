import { useState } from "react";
import { Film, type LucideIcon } from "lucide-react";

/**
 * L'affiche d'une lecture — ou, si elle ne se charge pas (média sans image,
 * serveur injoignable), un aplat au même format : jamais l'icône d'image
 * cassée du navigateur au milieu d'une carte. Sans adresse : l'aplat d'emblée.
 */
export function Poster({ src, width, height, className, icon: Icon = Film }: {
  src: string | null;
  width: number;
  height: number;
  className: string;
  /** Le dessin de l'aplat : une pellicule pour une vidéo, une note pour une écoute. */
  icon?: LucideIcon;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src === null || failed === src) {
    return (
      <div aria-hidden style={{ width, height }} className={`${className} grid place-items-center text-content-quaternary`}>
        <Icon size={Math.round(Math.min(width, height) / 3)} />
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
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={`${className} object-cover`}
    />
  );
}
