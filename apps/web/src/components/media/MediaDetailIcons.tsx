import { ArrowLeftIcon as ArrowLeftBase } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CheckCircleIcon as CheckCircleBase } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { FilmStripIcon } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { HeartIcon as HeartBase } from "@phosphor-icons/react/dist/csr/Heart";
import { StarIcon as StarBase } from "@phosphor-icons/react/dist/csr/Star";
import { PlayIcon as PlayBase } from "../icons/transport";

// Les pictogrammes de la fiche — les NOMS d'avant, dessinés par Phosphor (refonte de
// nov. 2026). Un état vrai (favori, Ma liste, vu) : l'icône PLEINE, à la teinte franche
// (`--accent`) — plus de rouge, de violet et de dégradé selon le bouton.
const OFF = "h-5 w-5 text-content-tertiary";
const ON = "h-5 w-5 text-accent";

export function PlayIcon() {
  return <PlayBase className="h-5 w-5" aria-hidden />;
}

export function ArrowLeftIcon() {
  return <ArrowLeftBase className="h-5 w-5" aria-hidden />;
}

export function ChevronRightIcon() {
  return <CaretRightIcon className="h-4 w-4" aria-hidden />;
}

export function FilmIcon() {
  return <FilmStripIcon className="h-5 w-5" aria-hidden />;
}

export function ExternalLinkIcon() {
  return <ArrowSquareOutIcon className="h-4 w-4" aria-hidden />;
}

// Étoile de notation : la teinte franche, comme tout ce qui dit un état ou une valeur.
export function StarIcon() {
  return <StarBase weight="fill" className="h-4 w-4 text-accent" aria-hidden />;
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return <HeartBase weight={filled ? "fill" : "regular"} className={filled ? ON : OFF} aria-hidden />;
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return <BookmarkSimpleIcon weight={filled ? "fill" : "regular"} className={filled ? ON : OFF} aria-hidden />;
}

export function CheckCircleIcon({ filled }: { filled: boolean }) {
  return <CheckCircleBase weight={filled ? "fill" : "regular"} className={filled ? ON : OFF} aria-hidden />;
}
