import { PressableGlass } from "../ui/glass/PressableGlass";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/HeroIcons";

/** En mode natif : la lentille exacte du disque (monté au survol seulement). */
const DISC_GLASS = { material: "bead", tone: "dark", level: "clear", shape: "circle" } as const;
/** La peau d'avant du disque (hors verre natif). */
// Hors verre : un disque d'encre PLEIN, sans flou ni liseré (le prototype validé) — il passe
// sur des affiches, un `backdrop-filter` n'y montrerait rien qu'un fond opaque ne dise déjà.
const DISC_SKIN = "rounded-full bg-surface-4 text-content-primary shadow-elev-2 transition-colors duration-hover hover:bg-surface-3";

interface RowScrollControlsProps {
  canLeft: boolean;
  canRight: boolean;
  /**
   * Les zones sont-elles DANS le DOM ? Piloté par `useHoverMount` chez
   * l'appelant : vrai pendant le survol de la rangée, et le temps du fondu de
   * sortie.
   */
  mounted: boolean;
  /** Cible du fondu — vrai tant que le curseur est sur la rangée. */
  shown: boolean;
  onScroll: (direction: "left" | "right") => void;
}

/**
 * Zones de défilement d'une rangée, révélées au survol.
 *
 * Le dégradé partait d'un `rgba(0,0,0,0.65)` EN DUR et le chevron d'un
 * `text-white` : en thème clair, une bavure noire sur le fond nacré, surmontée
 * d'un chevron blanc illisible. Les deux suivent désormais la page —
 * `--row-fade-*` (adossé à `--surface-0`) et `text-content-primary`.
 *
 * Montées à la demande, jamais laissées à `opacity: 0` : chaque disque porte un
 * `backdrop-filter`, et il y en a un à deux PAR RANGÉE. L'accueil en aligne une
 * dizaine — autant de couches composées dont l'arrière-plan était recopié et
 * refloué pour des contrôles invisibles. Même constat que pour les pastilles
 * de carte (`components/media/CardMetaOverlay.tsx`).
 */
export function RowScrollControls({ canLeft, canRight, mounted, shown, onScroll }: RowScrollControlsProps) {
  // `pointer-events-none` sur la zone, `auto` sur le seul disque : l'ancienne
  // version était un <button> plein cadre, qui avalait les clics des cartes
  // placées sous le bord de la rangée.
  //
  // `hover-reveal` (theme/reveal.css) remplace `opacity-0 …
  // group-hover/row:opacity-100` : même tempo (200 ms), mais l'entrée passe par
  // `@starting-style` puisqu'il n'existe aucun état précédent au montage.
  const zoneClass =
    "hover-reveal pointer-events-none absolute bottom-12 top-0 z-30 flex w-12 items-center justify-center md:w-16";
  const discClass = "pointer-events-auto flex h-10 w-10 items-center justify-center";
  const zoneStyle = { "--reveal-ms": "200ms" } as React.CSSProperties;

  if (!mounted) return null;

  return (
    <>
      {canLeft && (
        <div
          className={`${zoneClass} left-0`}
          data-shown={shown}
          style={{ ...zoneStyle, background: "var(--row-fade-left)" }}
        >
          <PressableGlass
            appearance={DISC_GLASS}
            fallbackClassName={DISC_SKIN}
            hoverScale={1}
            tapScale={0.97}
            onClick={() => onScroll("left")}
            aria-label="Défiler à gauche"
            className={discClass}
          >
            <ChevronLeftIcon />
          </PressableGlass>
        </div>
      )}

      {canRight && (
        <div
          className={`${zoneClass} right-0`}
          data-shown={shown}
          style={{ ...zoneStyle, background: "var(--row-fade-right)" }}
        >
          <PressableGlass
            appearance={DISC_GLASS}
            fallbackClassName={DISC_SKIN}
            hoverScale={1}
            tapScale={0.97}
            onClick={() => onScroll("right")}
            aria-label="Défiler à droite"
            className={discClass}
          >
            <ChevronRightIcon />
          </PressableGlass>
        </div>
      )}
    </>
  );
}
