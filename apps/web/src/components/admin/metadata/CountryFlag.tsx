import { memo } from "react";
import type { CountryFlags } from "./countryFlags";

interface CountryFlagProps {
  code: string;
  flags: CountryFlags | null;
  className?: string;
}

/** Le drapeau d'un pays, décoratif (le nom l'accompagne toujours) ; une case
 *  neutre de même taille tant que les drapeaux chargent — rien ne saute. */
export const CountryFlag = memo(function CountryFlag({ code, flags, className = "" }: CountryFlagProps) {
  const src = flags?.[code];
  const box = `h-4 w-6 shrink-0 rounded-[3px] ${className}`;
  if (!src) return <span aria-hidden className={`${box} bg-fill-soft`} />;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={`${box} object-cover ring-1 ring-line-subtle`}
    />
  );
});
