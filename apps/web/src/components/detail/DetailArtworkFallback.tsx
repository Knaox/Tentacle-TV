import { memo } from "react";
import { TentacleSvg } from "../ui/TentacleSvg";

/**
 * Les visuels de REPLI de la fiche, pour un titre sans images (Jellyfin ne les
 * a pas encore trouvées) : la fiche ne doit jamais avoir l'air vide ni cassée.
 *
 * Tout est STATIQUE (règles GPU) : aucun flou, aucune animation. À l'ENCRE, depuis la refonte
 * de nov. 2026 : plus de halos de marque (un dégradé décoratif) — la mascotte, qui illustre
 * l'état, garde seule ses couleurs.
 */

/**
 * Le décor de la scène sans backdrop : une lumière d'encre sur le panneau, sous
 * les voiles habituels (`DETAIL_STAGE_LAYERS`), qui gardent au texte son
 * assise sombre dans les deux thèmes.
 */
export const DETAIL_STAGE_FALLBACK_BACKGROUND = [
  "radial-gradient(70% 80% at 78% 20%, var(--surface-3) 0%, transparent 72%)",
  "var(--surface-1)",
].join(", ");

export function DetailStageFallback() {
  return (
    <div
      aria-hidden
      data-detail-fallback="stage"
      className="absolute inset-0"
      style={{ background: DETAIL_STAGE_FALLBACK_BACKGROUND }}
    />
  );
}

/**
 * L'affiche de repli : le dégradé de marque, la mascotte en filigrane et le
 * titre — au format de l'objet (2:3, 16:9 pour un épisode), pour que la
 * composition de la scène et la cible du calque d'ouverture ne changent pas.
 */
export const DetailPosterFallback = memo(function DetailPosterFallback({ title, wide }: { title: string; wide: boolean }) {
  return (
    <div
      data-detail-fallback="poster"
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden bg-surface-2 ${wide ? "aspect-video" : "aspect-[2/3]"}`}
    >
      <span className="opacity-80">
        <TentacleSvg size={wide ? 72 : 96} />
      </span>
      <span className="mt-3 line-clamp-3 break-words px-4 text-center font-display text-base font-bold leading-tight text-content-primary md:text-lg">
        {title}
      </span>
    </div>
  );
});
