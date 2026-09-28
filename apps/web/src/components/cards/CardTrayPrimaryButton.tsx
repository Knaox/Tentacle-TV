import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { stopCardClick } from "./cardEvents";

/**
 * Le ton de l'action primaire d'un plateau :
 *
 *   • `brand` — le dégradé de marque, la SEULE couleur du survol : « Demander »
 *     sur une carte hors bibliothèque ;
 *   • `quiet` — un verre plus dense que ses voisins, cerclé, sans couleur :
 *     une action primaire qui ne doit pas crier (« Lire »).
 */
export type CardTrayPrimaryTone = "brand" | "quiet";

interface CardTrayPrimaryButtonProps {
  /** Le gabarit des boutons du plateau (`TRAY_SIZE`, ou son jeton resserré) : le MÊME que ses voisins. */
  box: string;
  /** La taille du glyphe, du même jeton — la roue d'attente la reprend. */
  icon: string;
  tone: CardTrayPrimaryTone;
  /** Le nom complet du geste, lu par les lecteurs d'écran et en bulle (« Demander — Dune »). */
  label: string;
  onPress: () => void;
  /** Le geste est en route : une roue à la place du glyphe, le bouton ne répond plus. */
  busy?: boolean;
  /** Le glyphe, dessiné par l'appelant à la taille `icon`. */
  children: ReactNode;
}

const TONES: Record<CardTrayPrimaryTone, string> = {
  brand:
    "bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] text-cta-brand-fg ring-1 ring-inset ring-white/25 shadow-[0_2px_10px_rgba(var(--brand-rgb),0.5)]",
  quiet: "bg-white/20 text-white ring-1 ring-inset ring-white/30 hover:bg-white/30",
};

/**
 * L'action PRIMAIRE d'une carte, en tête de son plateau — et plus au centre de
 * l'affiche : le survol ne pose plus de gros bouton sur l'image, tous ses
 * gestes vivent dans la capsule du bas (`CardTrayCapsule`).
 *
 * Aucune taille propre : elle prend le gabarit de ses voisins (`box`, `icon`),
 * et quand le plateau se resserre sur une affiche étroite, elle se resserre
 * avec lui. Ce qui la distingue, c'est sa place (la première) et son ton.
 *
 * Pas une bascule : pas d'`aria-pressed`. Occupée, elle n'est pas `disabled` —
 * le clic d'un bouton désactivé peut retomber sur la carte, qui ouvrirait la
 * fiche : elle l'avale et ne fait rien. Les touches ne remontent pas non plus,
 * la coque du survol les arrête.
 */
export function CardTrayPrimaryButton({ box, icon, tone, label, onPress, busy = false, children }: CardTrayPrimaryButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      title={label}
      onClick={(e) => {
        stopCardClick(e);
        if (!busy) onPress();
      }}
      className={`${box} flex shrink-0 items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
        busy ? "cursor-wait" : "hover:scale-110 active:scale-95"
      } ${TONES[tone]}`}
    >
      {busy ? <Loader2 className={`${icon} animate-spin`} aria-hidden /> : children}
    </button>
  );
}
