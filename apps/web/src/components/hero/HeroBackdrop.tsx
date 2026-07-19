import { AnimatePresence, motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

interface HeroBackdropProps {
  items: MediaItem[];
  activeIndex: number;
}

/**
 * Hero backdrop synchronisé avec la rotation du carrousel :
 *  • Zoom doux scale(1) → scale(1.10) sur ~10s avec ease-out (cubic-bezier
 *    0.16,1,0.3,1) — la sensation "plus ça zoom plus c'est lent" vient de
 *    cette courbe : la vitesse perçue décroît continûment jusqu'à l'arrêt.
 *  • À la fin du zoom, HeroBillboard déclenche le slide suivant ; l'image
 *    sortante fade-out pendant que la nouvelle fade-in + recommence son
 *    propre zoom depuis scale(1). L'enchaînement infini donne l'impression
 *    d'un zoom continu sans coupure mécanique.
 *
 * Seul l'item actif est rendu (+ l'item sortant brièvement durant le fade),
 * via AnimatePresence — plus de stack de N <img> avec opacity à zéro.
 */
export const HERO_ZOOM_DURATION_S = 8;
const FADE_DURATION_S = 1.2;
// Scale 1 → 1.06 perçu comme un travelling lent et CONSTANT sur 9.5s. On
// utilise `linear` exprès : un ease-out tassait 80% du mouvement sur les 3
// premières secondes, donnant l'illusion d'un zoom court — le reste de la
// durée l'image paraissait figée. Linear étale uniformément la motion.
const TARGET_SCALE = 1.06;

export function HeroBackdrop({ items, activeIndex }: HeroBackdropProps) {
  const client = useJellyfinClient();
  const item = items[activeIndex];

  // Solid base + gradients restent rendus en permanence (jamais animés).
  const overlays = (
    <>
      {/* Pile de degrades cinema. Les degrades COMPLETS vivent dans index.css
          (`--hero-scrim-*`) : la geometrie differe par schema — voiles larges
          historiques en sombre, voile confine a la colonne de texte en clair
          pour que l'affiche reste propre. Recolorer les memes stops donnait un
          brouillard laiteux sur toute l'image. */}
      {/* Flou progressif (clair uniquement, cf. index.css .hero-glass) : trois
          couches SOUS les degrades, pour que la couture basse se fonde aussi
          dans la zone floutee. */}
      <div className="hero-glass hero-glass-1 absolute inset-y-0 left-0 w-[64%]" />
      <div className="hero-glass hero-glass-2 absolute inset-y-0 left-0 w-[64%]" />
      <div className="hero-glass hero-glass-3 absolute inset-y-0 left-0 w-[64%]" />
      <div className="absolute inset-0" style={{ background: "var(--hero-scrim-left)" }} />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{ background: "var(--hero-scrim-bottom)" }}
      />
      {/* Vignette haute sous la TopNav — la nav est en texte theme, son assise
          suit le schema. */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{ background: "var(--hero-scrim-top)" }}
      />
      {/* Tiny grain to avoid banding on solid color zones — pas de mix-blend-mode
       * pour éviter le rectangle blanc fantôme dans Tauri WKWebView. */}
      <div className="noise-texture absolute inset-0 opacity-[0.06]" aria-hidden />
    </>
  );

  if (!item) {
    return (
      <>
        <div className="absolute inset-0 bg-surface-0" />
        {overlays}
      </>
    );
  }

  const isEp = item.Type === "Episode";
  const hasParentBackdrop = (item.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (item.BackdropImageTags?.length ?? 0) > 0;
  const backdropId = isEp
    ? hasParentBackdrop
      ? (item.ParentBackdropItemId ?? item.SeriesId ?? item.Id)
      : item.Id
    : item.Id;
  const url = hasParentBackdrop || hasOwnBackdrop
    ? client.getImageUrl(backdropId, "Backdrop", { width: 1920, quality: 85 })
    : null;

  return (
    <>
      <div className="absolute inset-0 bg-surface-0" />

      <AnimatePresence>
        {url && (
          <motion.img
            key={item.Id}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: TARGET_SCALE }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: FADE_DURATION_S, ease: "easeOut" },
              scale: { duration: HERO_ZOOM_DURATION_S, ease: "linear" },
            }}
            className="absolute inset-0 h-full w-full object-cover will-change-transform motion-reduce:!transform-none"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </AnimatePresence>

      {overlays}
    </>
  );
}
