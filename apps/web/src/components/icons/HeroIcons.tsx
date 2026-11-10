import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { InfoIcon as InfoBase } from "@phosphor-icons/react/dist/csr/Info";
import { StarIcon as StarBase } from "@phosphor-icons/react/dist/csr/Star";
import { PlayIcon as PlayBase } from "./transport";

/**
 * Les pictogrammes de la bannière — les NOMS d'avant, dessinés désormais par Phosphor
 * (refonte de nov. 2026, docs/REFONTE-UI.md). Du code nouveau importe l'icône du paquet.
 */
export function PlayIcon() {
  return <PlayBase className="h-5 w-5" aria-hidden />;
}

export function StarIcon() {
  return <StarBase weight="fill" className="h-3.5 w-3.5" aria-hidden />;
}

export function ChevronLeftIcon() {
  return <CaretLeftIcon weight="bold" className="h-5 w-5" aria-hidden />;
}

export function ChevronRightIcon() {
  return <CaretRightIcon weight="bold" className="h-5 w-5" aria-hidden />;
}

export function ChevronDownIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <CaretDownIcon weight="bold" className={className} aria-hidden />;
}

export function InfoIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <InfoBase className={className} aria-hidden />;
}
