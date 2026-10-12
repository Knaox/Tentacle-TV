import { memo } from "react";
import { TentacleSvg } from "../ui/TentacleSvg";

/**
 * Les visuels de REPLI de la fiche, pour un titre sans images (Jellyfin ne les
 * a pas encore trouvées) : la fiche ne doit jamais avoir l'air vide ni cassée.
 *
 * Tout est STATIQUE (règles GPU) : dégradés posés une fois, aucun flou, aucune
 * animation. Les couleurs viennent des jetons de marque (`--brand-rgb`,
 * `--brand-accent-rgb`) : une marque redéfinie par l'administrateur s'y
 * propage, comme sur le logo.
 */

/**
 * Le décor de la scène sans backdrop : deux halos de marque sur la page, sous
 * les voiles habituels (`DETAIL_STAGE_LAYERS`), qui gardent au texte son
 * assise sombre dans les deux thèmes.
 */
export const DETAIL_STAGE_FALLBACK_BACKGROUND = [
  "radial-gradient(58% 64% at 80% 26%, rgba(var(--brand-rgb), 0.34) 0%, transparent 72%)",
  "radial-gradient(46% 52% at 98% 78%, rgba(var(--brand-accent-rgb), 0.24) 0%, transparent 70%)",
  "radial-gradient(40% 40% at 8% 12%, rgba(var(--brand-rgb), 0.12) 0%, transparent 70%)",
  "var(--surface-0)",
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
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden ${wide ? "aspect-video" : "aspect-[2/3]"}`}
      style={{
        background:
          "radial-gradient(90% 70% at 30% 18%, rgba(var(--brand-rgb), 0.55) 0%, transparent 70%), " +
          "radial-gradient(80% 60% at 85% 95%, rgba(var(--brand-accent-rgb), 0.45) 0%, transparent 70%), " +
          // Base SOMBRE fixe dans les deux thèmes : c'est une image, le titre
          // blanc y garde son contraste (comme le texte `on-media`).
          "linear-gradient(160deg, #1a1226, #08060c)",
      }}
    >
      <span className="opacity-80">
        <TentacleSvg size={wide ? 72 : 96} />
      </span>
      <span className="mt-3 line-clamp-3 break-words px-4 text-center text-base font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] md:text-lg">
        {title}
      </span>
    </div>
  );
});
