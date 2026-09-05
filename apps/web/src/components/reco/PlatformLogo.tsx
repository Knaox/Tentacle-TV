import { memo, useState } from "react";

const TMDB_LOGO = "https://image.tmdb.org/t/p/w92";

interface PlatformLogoProps {
  logoPath: string | null;
  label: string;
  className?: string;
}

/** Le logo TMDB d'une plateforme ; sans logo ou image cassée, un monogramme
 *  (initiale) — jamais d'icône cassée, jamais de case vide. */
export const PlatformLogo = memo(function PlatformLogo({ logoPath, label, className = "h-7 w-7" }: PlatformLogoProps) {
  const [broken, setBroken] = useState(false);
  if (logoPath && !broken) {
    return (
      <img
        src={`${TMDB_LOGO}${logoPath}`}
        alt=""
        decoding="async"
        loading="lazy"
        draggable={false}
        onError={() => setBroken(true)}
        className={`${className} shrink-0 rounded-md object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-md bg-fill-soft text-xs font-bold text-content-tertiary`}
    >
      {label.charAt(0)}
    </span>
  );
});
