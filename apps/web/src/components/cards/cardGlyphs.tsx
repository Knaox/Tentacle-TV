import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { PlayIcon } from "../icons/transport";

/**
 * Les glyphes des cartes — marqueurs d'état au repos, bascules au survol.
 *
 * Dessinés par Phosphor depuis la refonte de nov. 2026 (docs/REFONTE-UI.md) : au TRAIT au
 * repos, PLEINS quand l'état est vrai — un signet reconnu au repos se retrouve tel quel sous
 * le curseur, c'est ce qui dit « c'est ici qu'on l'enlève ».
 *
 * Les tracés de `@tentacle-tv/shared` (`cardMarkerGlyphs.ts`) ne changent pas : le mobile et
 * la TV les lisent toujours, et sur le web l'étoile de la note à demi remplie
 * (`DetailScoreline`, `TouchStarRating`) en a encore besoin — un dégradé se pose sur un tracé.
 */

interface GlyphProps {
  className?: string;
  /** L'état est vrai : le glyphe se remplit. */
  filled?: boolean;
}

const weightOf = (filled: boolean) => (filled ? "fill" : "regular");

/** Ma liste. */
export function BookmarkGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return <BookmarkSimpleIcon className={className} weight={weightOf(filled)} aria-hidden />;
}

/** Favori. */
export function HeartGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return <HeartIcon className={className} weight={weightOf(filled)} aria-hidden />;
}

/** Vu : le cercle coché, évidé tant que ce n'est pas vu. */
export function WatchedGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return <CheckCircleIcon className={className} weight={weightOf(filled)} aria-hidden />;
}

/** Gardé hors ligne : la flèche vers son plateau, pleine — jamais une coche (c'est « vu »). */
export function KeptGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <DownloadSimpleIcon className={className} weight="fill" aria-hidden />;
}

/** L'étoile de la note. */
export function StarGlyph({ className = "h-3 w-3" }: { className?: string }) {
  return <StarIcon className={className} weight="fill" aria-hidden />;
}

/** Lire — transport, donc toujours plein. */
export function PlayGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return <PlayIcon className={className} aria-hidden />;
}
