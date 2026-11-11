import type { ReactNode } from "react";
import { CircleNotchIcon as Loader2 } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { stopCardClick } from "./cardEvents";
import { GLASS_LENS_PROPS, useLiquidGlassSurface } from "../../theme/glass";
import { useTrayGlassAllowed } from "./CardTrayParts";

/**
 * Le ton de l'action primaire d'un plateau :
 *
 *   • `brand` — la teinte franche de la marque, la SEULE couleur du survol :
 *     « Demander » sur une carte hors bibliothèque ;
 *   • `quiet` — un disque ivoire, sans couleur : une action primaire qui ne
 *     doit pas crier (« Lire »).
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
  // « Demander » : l'aplat à la teinte franche, son encre dessus (le dégradé du logo ne sert plus
  // qu'à lire et à mesurer). « Lire » : le disque ivoire, glyphe à l'encre — le premier que l'œil trouve.
  brand: "bg-[#E58CF0] text-[#27062E] hover:bg-[#EDA4F5]",
  quiet: "bg-on-media-primary text-[#131315] hover:bg-white",
};

/**
 * L'action PRIMAIRE d'une carte, en tête de son plateau — et plus au centre de
 * l'affiche : le survol ne pose plus de gros bouton sur l'image, tous ses
 * gestes vivent dans la capsule du bas (`CardTrayCapsule`).
 *
 * Aucune taille propre : elle prend le gabarit de ses voisins (`box`, `icon`),
 * et quand le plateau se resserre sur une affiche étroite, elle se resserre
 * avec lui — d'où l'absence de `shrink-0` (cf. `TRAY_SIZE`). Ce qui la
 * distingue, c'est sa place (la première) et son ton.
 *
 * Pas une bascule : pas d'`aria-pressed`. Occupée, elle n'est pas `disabled` —
 * le clic d'un bouton désactivé peut retomber sur la carte, qui ouvrirait la
 * fiche : elle l'avale et ne fait rien. Les touches ne remontent pas non plus,
 * la coque du survol les arrête.
 */
export function CardTrayPrimaryButton({ box, icon, tone, label, onPress, busy = false, children }: CardTrayPrimaryButtonProps) {
  // Verre natif : une pastille ronde comme ses voisines — « Lire » en verre
  // clair, « Demander » avec la marque DANS le verre (`prominent`).
  const layout = `${box} flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${busy ? "cursor-wait" : ""}`;
  const skin = `rounded-full transition-[transform,background-color] duration-press ease-out ${busy ? "" : "active:scale-[var(--press-scale)]"} ${TONES[tone]}`;
  const glassAllowed = useTrayGlassAllowed();
  const glass = useLiquidGlassSurface({
    level: tone === "brand" ? "prominent" : "clear",
    shape: "circle",
    interactive: !busy,
    className: layout,
    fallbackClassName: skin,
  });
  const surface = glassAllowed ? glass.props : { className: `${layout} ${skin}` };
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      title={label}
      // La mini-carte d'aperçu la peint pleine, au dégradé de son ton (`preview/previewActions.css`).
      data-tray-primary={tone}
      {...GLASS_LENS_PROPS}
      {...surface}
      onClick={(e) => {
        stopCardClick(e);
        if (!busy) onPress();
      }}
    >
      {glassAllowed && glass.layers}
      {busy ? <Loader2 className={`${icon} animate-spin`} aria-hidden /> : children}
    </button>
  );
}
